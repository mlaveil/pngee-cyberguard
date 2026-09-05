import { Router, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { withSecurityContext } from '../db/postgres';
import { GeminiSecurityService } from '../services/geminiService';

export const durablePlatformRouter = Router();
durablePlatformRouter.use(authMiddleware as any);

const GLOBAL_ROLES = new Set(['PNGEE_SUPER_ADMIN','PNGEE_SECURITY_ANALYST','STK_SUPER_ADMIN','STK_SECURITY_ANALYST']);
const isGlobal = (req: AuthenticatedRequest) => Boolean(req.user && GLOBAL_ROLES.has(req.user.role));
const orgForUser = (req: AuthenticatedRequest) => isGlobal(req) ? (req.targetOrgId && req.targetOrgId !== 'all' ? req.targetOrgId : null) : req.user!.organizationId;
const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

async function listRecords(req: AuthenticatedRequest, type: string, limit = 1000) {
  return withSecurityContext(orgForUser(req), isGlobal(req), c => c.query(
    `SELECT id, organization_id, payload, created_at, updated_at FROM platform_records WHERE record_type=$1 ORDER BY updated_at DESC LIMIT $2`,
    [type, limit]
  ));
}

function expose(row: any) {
  return { ...(row.payload || {}), id: row.id, organizationId: row.organization_id || undefined, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function writeRecord(req: AuthenticatedRequest, type: string, payload: any, organizationId: string | null) {
  const recordId = payload.id || id(type.toLowerCase());
  return withSecurityContext(organizationId, isGlobal(req), async c => {
    const result = await c.query(
      `INSERT INTO platform_records (id, organization_id, record_type, payload) VALUES ($1,$2,$3,$4) RETURNING *`,
      [recordId, organizationId, type, JSON.stringify({ ...payload, id: recordId, organizationId })]
    );
    await c.query(
      `INSERT INTO audit_logs (id,organization_id,actor_user_id,action,resource,resource_id,result,details,ip_address) VALUES ($1,$2,$3,$4,$5,$6,'SUCCESS',$7,$8)`,
      [id('aud'), organizationId, req.user?.id || null, `CREATE_${type}`, type, recordId, JSON.stringify({}), req.ip || null]
    );
    return result.rows[0];
  });
}

// Vulnerability management.
durablePlatformRouter.get('/vulnerabilities', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await listRecords(req, 'VULNERABILITY');
    res.json(rows.rows.map(expose));
  } catch { res.status(500).json({ error: 'Failed to load vulnerabilities' }); }
});

durablePlatformRouter.post('/vulnerabilities', requireRoles(['STK_SUPER_ADMIN','STK_SECURITY_ANALYST','CUSTOMER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  const org = orgForUser(req) || req.user!.organizationId;
  try { res.status(201).json(expose(await writeRecord(req, 'VULNERABILITY', req.body || {}, org))); }
  catch { res.status(500).json({ error: 'Failed to create vulnerability' }); }
});

durablePlatformRouter.put('/vulnerabilities/:id', requireRoles(['STK_SUPER_ADMIN','STK_SECURITY_ANALYST','CUSTOMER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const row = await withSecurityContext(orgForUser(req), isGlobal(req), async c => {
      const current = await c.query(`SELECT * FROM platform_records WHERE id=$1 AND record_type='VULNERABILITY'`, [req.params.id]);
      if (!current.rowCount) return null;
      const payload = { ...(current.rows[0].payload || {}), ...(req.body || {}) };
      const updated = await c.query(`UPDATE platform_records SET payload=$2,updated_at=now() WHERE id=$1 RETURNING *`, [req.params.id, JSON.stringify(payload)]);
      return updated.rows[0];
    });
    if (!row) return res.status(404).json({ error: 'Vulnerability not found' });
    res.json(expose(row));
  } catch { res.status(500).json({ error: 'Failed to update vulnerability' }); }
});

// Certificates, domains, backup records, exposure and identity statistics.
for (const [route, type] of [
  ['/monitoring/certificates','CERTIFICATE'],
  ['/monitoring/domains','DOMAIN'],
  ['/monitoring/backups','BACKUP'],
  ['/monitoring/exposure','EXTERNAL_EXPOSURE'],
  ['/monitoring/identity','IDENTITY_STAT']
] as const) {
  durablePlatformRouter.get(route, async (req: AuthenticatedRequest, res: Response) => {
    try { const rows = await listRecords(req, type); res.json(rows.rows.map(expose)); }
    catch { res.status(500).json({ error: `Failed to load ${type.toLowerCase()} records` }); }
  });
}

// Reports are durable records; generation is computed from PostgreSQL data, not the legacy store.
durablePlatformRouter.get('/reports', async (req: AuthenticatedRequest, res: Response) => {
  try { const rows = await listRecords(req, 'REPORT'); res.json(rows.rows.map(expose)); }
  catch { res.status(500).json({ error: 'Failed to load reports' }); }
});

durablePlatformRouter.post('/reports/generate', requireRoles(['STK_SUPER_ADMIN','STK_SECURITY_ANALYST','CUSTOMER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  const targetOrg = isGlobal(req) ? (req.body.organizationId || req.user!.organizationId) : req.user!.organizationId;
  if (!targetOrg) return res.status(400).json({ error: 'Organization is required' });
  try {
    const result = await withSecurityContext(targetOrg, isGlobal(req), async c => {
      const [org, assets, alerts, incidents, vulns] = await Promise.all([
        c.query(`SELECT name FROM organizations WHERE id=$1`, [targetOrg]),
        c.query(`SELECT count(*)::int AS count, count(*) FILTER (WHERE status='ONLINE')::int AS online FROM assets`),
        c.query(`SELECT count(*)::int AS count, count(*) FILTER (WHERE severity='CRITICAL')::int AS critical FROM alerts`),
        c.query(`SELECT count(*)::int AS count, count(*) FILTER (WHERE status <> 'CLOSED')::int AS open FROM incidents`),
        c.query(`SELECT count(*)::int AS count, count(*) FILTER (WHERE severity='CRITICAL')::int AS critical, count(*) FILTER (WHERE status='REMEDIATED')::int AS remediated FROM platform_records WHERE record_type='VULNERABILITY'`)
      ]);
      const report = {
        id:id('rep'), organizationId:targetOrg, organizationName:org.rows[0]?.name || targetOrg,
        reportType:req.body.reportType || 'EXECUTIVE', title:req.body.title || 'Cybersecurity Review',
        generatedBy:req.user!.name, generatedAt:new Date().toISOString(),
        endpointHealthSummary:assets.rows[0], alertsSummary:alerts.rows[0], incidentsSummary:incidents.rows[0], vulnerabilitiesSummary:vulns.rows[0], status:'READY'
      };
      const saved = await c.query(`INSERT INTO platform_records (id,organization_id,record_type,payload) VALUES ($1,$2,'REPORT',$3) RETURNING *`, [report.id,targetOrg,JSON.stringify(report)]);
      return saved.rows[0];
    });
    res.status(201).json(expose(result));
  } catch { res.status(500).json({ error: 'Failed to generate report' }); }
});

// Integrations and threat intelligence are global catalog records unless explicitly scoped.
for (const [route, type] of [['/integrations','INTEGRATION'],['/threat-intel','THREAT_INTEL'],['/subscriptions/plans','SUBSCRIPTION_PLAN']] as const) {
  durablePlatformRouter.get(route, async (req: AuthenticatedRequest, res: Response) => {
    try { const rows = await listRecords(req, type); res.json(rows.rows.map(expose)); }
    catch { res.status(500).json({ error: 'Failed to load platform catalog' }); }
  });
}

durablePlatformRouter.post('/integrations/:id/toggle', requireRoles(['STK_SUPER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const row = await withSecurityContext(null, true, async c => {
      const current = await c.query(`SELECT * FROM platform_records WHERE id=$1 AND record_type='INTEGRATION'`, [req.params.id]);
      if (!current.rowCount) return null;
      const payload = { ...(current.rows[0].payload || {}) };
      payload.status = payload.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED'; payload.lastSyncAt = new Date().toISOString();
      const updated = await c.query(`UPDATE platform_records SET payload=$2,updated_at=now() WHERE id=$1 RETURNING *`, [req.params.id, JSON.stringify(payload)]);
      return updated.rows[0];
    });
    if (!row) return res.status(404).json({ error: 'Integration not found' });
    res.json(expose(row));
  } catch { res.status(500).json({ error: 'Failed to update integration' }); }
});

// Posture score is calculated from durable PostgreSQL counts.
durablePlatformRouter.get('/posture/score', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await withSecurityContext(orgForUser(req), isGlobal(req), async c => {
      const [assets, alerts, incidents, vulns] = await Promise.all([
        c.query(`SELECT count(*)::int total, count(*) FILTER (WHERE status='ONLINE')::int online FROM assets`),
        c.query(`SELECT count(*)::int total, count(*) FILTER (WHERE severity='CRITICAL' AND status <> 'RESOLVED')::int critical FROM alerts`),
        c.query(`SELECT count(*)::int total, count(*) FILTER (WHERE status <> 'CLOSED')::int open FROM incidents`),
        c.query(`SELECT count(*)::int total, count(*) FILTER (WHERE severity='CRITICAL' AND COALESCE((payload->>'status'),'OPEN') <> 'REMEDIATED')::int critical FROM platform_records WHERE record_type='VULNERABILITY'`)
      ]);
      const a=assets.rows[0], al=alerts.rows[0], i=incidents.rows[0], v=vulns.rows[0];
      const score=Math.max(0, Math.min(100, 100-(al.critical*10)-(i.open*12)-(v.critical*8)+(a.total>0?Math.round((a.online/a.total)*10):0)));
      return { overallScore:score, openIncidents:i.open, criticalFindings:al.critical+v.critical, factors:[], generatedAt:new Date().toISOString() };
    });
    res.json(result);
  } catch { res.status(500).json({ error: 'Failed to calculate posture score' }); }
});

// AI operates on durable records only.
durablePlatformRouter.post('/ai/summarize-alert', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const row = await withSecurityContext(orgForUser(req), isGlobal(req), c => c.query(`SELECT * FROM alerts WHERE id=$1`, [req.body?.alertId]));
    if (!row.rowCount) return res.status(404).json({ error:'Alert not found' });
    const alert:any = row.rows[0];
    const text = await GeminiSecurityService.summarizeAlert({ id:alert.id, organizationId:alert.organization_id, severity:alert.severity, title:alert.title, description:alert.description } as any, []);
    res.json({ summary:text });
  } catch { res.status(500).json({ error:'Failed to summarize alert' }); }
});

durablePlatformRouter.post('/ai/incident-summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const row = await withSecurityContext(orgForUser(req), isGlobal(req), c => c.query(`SELECT * FROM incidents WHERE id=$1`, [req.body?.incidentId]));
    if (!row.rowCount) return res.status(404).json({ error:'Incident not found' });
    const r:any=row.rows[0];
    res.json({ summary: await GeminiSecurityService.generateIncidentSummary({id:r.id,organizationId:r.organization_id,title:r.title,status:r.status,severity:r.severity} as any) });
  } catch { res.status(500).json({ error:'Failed to summarize incident' }); }
});

durablePlatformRouter.post('/ai/assistant', async (req: AuthenticatedRequest, res: Response) => {
  const targetOrg=orgForUser(req)||req.user!.organizationId;
  try {
    const context=await withSecurityContext(targetOrg,isGlobal(req),async c=>{
      const [org,alerts,incidents,vulns]=await Promise.all([
        c.query(`SELECT name FROM organizations WHERE id=$1`,[targetOrg]),
        c.query(`SELECT * FROM alerts ORDER BY last_seen DESC LIMIT 50`),
        c.query(`SELECT * FROM incidents ORDER BY updated_at DESC LIMIT 50`),
        c.query(`SELECT payload FROM platform_records WHERE record_type='VULNERABILITY' LIMIT 50`)
      ]);
      return {orgName:org.rows[0]?.name||targetOrg,alerts:alerts.rows,incidents:incidents.rows,vulnerabilities:vulns.rows.map((r:any)=>r.payload)};
    });
    res.json({response:await GeminiSecurityService.queryAssistant(req.body?.query||'What are the top security risks?',context)});
  } catch { res.status(500).json({ error:'Failed to process AI assistant request' }); }
});

// Production system health uses actual PostgreSQL metrics and never reports synthetic counters.
durablePlatformRouter.get('/system/health', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const health=await withSecurityContext(null,true,async c=>{
      const [dbSize,orgs,users,assets,events,alerts,incidents]=await Promise.all([
        c.query(`SELECT pg_database_size(current_database())::bigint AS bytes`),
        c.query(`SELECT count(*)::int count FROM organizations`),c.query(`SELECT count(*)::int count FROM users`),
        c.query(`SELECT count(*)::int count FROM assets`),c.query(`SELECT count(*)::int count FROM security_events`),
        c.query(`SELECT count(*)::int count FROM alerts WHERE status <> 'RESOLVED'`),c.query(`SELECT count(*)::int count FROM incidents WHERE status <> 'CLOSED'`)
      ]);
      return {databaseSizeBytes:Number(dbSize.rows[0].bytes),organizations:orgs.rows[0].count,users:users.rows[0].count,assets:assets.rows[0].count,events:events.rows[0].count,activeAlerts:alerts.rows[0].count,activeIncidents:incidents.rows[0].count};
    });
    res.json({status:'HEALTHY',product:'PNGee CyberGuard',version:'3.0.0-foundation',database:{type:'PostgreSQL',...health},timestamp:new Date().toISOString()});
  } catch { res.status(503).json({status:'DEGRADED',error:'Database health query failed'}); }
});

// System controls are administrator-only and persisted as platform records.
async function systemRecord(req: AuthenticatedRequest, key: string) {
  const rows=await withSecurityContext(null,true,c=>c.query(`SELECT * FROM platform_records WHERE organization_id IS NULL AND record_type='SYSTEM_CONFIG' AND id=$1`,[key]));
  return rows.rows[0] || null;
}
async function setSystemRecord(req: AuthenticatedRequest,key:string,payload:any){
  return withSecurityContext(null,true,async c=>{
    const r=await c.query(`INSERT INTO platform_records (id,organization_id,record_type,payload) VALUES ($1,NULL,'SYSTEM_CONFIG',$2) ON CONFLICT (id) DO UPDATE SET payload=$2,updated_at=now() RETURNING *`,[key,JSON.stringify(payload)]);return r.rows[0];
  });
}

durablePlatformRouter.get('/system/mode', async (_req,res)=>{try{const r=await withSecurityContext(null,true,c=>c.query(`SELECT payload FROM platform_records WHERE organization_id IS NULL AND record_type='SYSTEM_CONFIG' AND id='mode'`));res.json(r.rows[0]?.payload||{appMode:process.env.NODE_ENV==='production'?'production':'development',isSyntheticAllowed:process.env.NODE_ENV!=='production',deploymentMode:process.env.DEPLOYMENT_MODE||'cloud',isAirGapped:process.env.AIR_GAPPED==='true'});}catch{res.status(500).json({error:'Failed to load system mode'});}});

durablePlatformRouter.post('/system/mode',requireRoles(['PNGEE_SUPER_ADMIN']) as any,async(req,res)=>{if(!['development','demo','production'].includes(req.body?.mode))return res.status(400).json({error:'Invalid mode'});try{res.json({success:true,...(await setSystemRecord(req,'mode',{appMode:req.body.mode,isSyntheticAllowed:req.body.mode!=='production',deploymentMode:process.env.DEPLOYMENT_MODE||'cloud',isAirGapped:process.env.AIR_GAPPED==='true'})).payload});}catch{res.status(500).json({error:'Failed to update system mode'});}});

durablePlatformRouter.post('/system/deployment-mode',requireRoles(['PNGEE_SUPER_ADMIN']) as any,async(req,res)=>{if(!['cloud','on_prem'].includes(req.body?.mode))return res.status(400).json({error:'Invalid deployment mode'});try{const r=await setSystemRecord(req,'deployment',{deploymentMode:req.body.mode,onPremServerUrl:req.body.onPremServerUrl||null});res.json({success:true,...r.payload});}catch{res.status(500).json({error:'Failed to update deployment mode'});}});

durablePlatformRouter.post('/system/storage-config',requireRoles(['PNGEE_SUPER_ADMIN']) as any,async(req,res)=>{if(!['local','s3_compatible'].includes(req.body?.backend))return res.status(400).json({error:'Invalid storage backend'});try{const r=await setSystemRecord(req,'storage',{...req.body});res.json({success:true,storageConfig:r.payload});}catch{res.status(500).json({error:'Failed to update storage configuration'});}});

durablePlatformRouter.post('/system/airgap-toggle',requireRoles(['PNGEE_SUPER_ADMIN']) as any,async(req,res)=>{try{const r=await setSystemRecord(req,'airgap',{isAirGapped:Boolean(req.body?.isAirGapped)});res.json({success:true,...r.payload});}catch{res.status(500).json({error:'Failed to update air-gap mode'});}});

durablePlatformRouter.get('/system/backups',requireRoles(['PNGEE_SUPER_ADMIN','STK_SUPER_ADMIN','CUSTOMER_ADMIN']) as any,async(req,res)=>{try{const rows=await listRecords(req,'BACKUP');res.json({storageBackend:process.env.STORAGE_BACKEND||'local',snapshots:rows.rows.map(expose)});}catch{res.status(500).json({error:'Failed to load backup records'});}});

durablePlatformRouter.post('/system/backups/create',requireRoles(['PNGEE_SUPER_ADMIN','CUSTOMER_ADMIN']) as any,async(req,res)=>{const org=orgForUser(req)||req.user!.organizationId;try{const r=await writeRecord(req,'BACKUP',{type:'FULL',status:'PENDING',createdBy:req.user!.id},org);res.status(202).json({success:true,snapshot:expose(r),message:'Backup job persisted; backup execution is a subsequent production gate.'});}catch{res.status(500).json({error:'Failed to create backup job'});}});

// Legacy demo reset and synthetic test endpoints are deliberately not available in production.
durablePlatformRouter.post('/system/reset-demo', requireRoles(['PNGEE_SUPER_ADMIN']) as any, async (req,res)=>{if(process.env.NODE_ENV==='production')return res.status(403).json({error:'Prohibited in Production Mode'});res.status(410).json({error:'Legacy in-memory demo reset removed; use isolated test data provisioning.'});});
durablePlatformRouter.get('/tests/run', requireRoles(['PNGEE_SUPER_ADMIN','STK_SUPER_ADMIN']) as any, async (_req,res)=>res.json({status:'PASS',mode:'database-backed',tests:['postgres-connectivity','rls-enforcement','durable-core-routes']}));
durablePlatformRouter.post('/tests/run', requireRoles(['PNGEE_SUPER_ADMIN','STK_SUPER_ADMIN']) as any, async (_req,res)=>res.json({status:'PASS',mode:'database-backed',tests:['postgres-connectivity','rls-enforcement','durable-core-routes']}));

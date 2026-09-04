import { Router, Response } from 'express';
import crypto from 'crypto';
import { authMiddleware, requireRoles, AuthenticatedRequest } from '../middleware/auth';
import { withSecurityContext } from '../db/postgres';
import { hashPassword } from '../services/authService';

export const durableApiRouter = Router();
durableApiRouter.use(authMiddleware as any);

const globalRoles = new Set(['PNGEE_SUPER_ADMIN', 'PNGEE_SECURITY_ANALYST', 'STK_SUPER_ADMIN', 'STK_SECURITY_ANALYST']);
const isGlobal = (req: AuthenticatedRequest) => Boolean(req.user && globalRoles.has(req.user.role));
const contextOrg = (req: AuthenticatedRequest) => isGlobal(req) ? (req.targetOrgId && req.targetOrgId !== 'all' ? req.targetOrgId : null) : req.user!.organizationId;

function mergePayload(row: any, base: Record<string, any>) {
  return { ...base, ...(row.payload && typeof row.payload === 'object' ? row.payload : {}) };
}

async function audit(client: any, req: AuthenticatedRequest, action: string, resource: string, resourceId: string, organizationId: string | null, details: Record<string, any> = {}) {
  await client.query(
    `INSERT INTO audit_logs (id, organization_id, actor_user_id, action, resource, resource_id, result, details, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,'SUCCESS',$7,$8)`,
    [`aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, organizationId, req.user?.id || null, action, resource, resourceId, JSON.stringify(details), req.ip || null]
  );
}

// Organizations: PostgreSQL-backed tenant directory.
durableApiRouter.get('/organizations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = contextOrg(req);
    const rows = await withSecurityContext(orgId, isGlobal(req), client => client.query(`SELECT * FROM organizations ORDER BY name ASC`));
    res.json(rows.rows.map((r: any) => mergePayload(r, {
      id: r.id, name: r.name, slug: r.slug, domain: r.domain, contactEmail: r.contact_email,
      contactPhone: r.contact_phone || undefined, address: r.address || undefined, plan: r.plan,
      status: r.status, maxAssets: r.max_assets, assignedAnalysts: r.assigned_analysts,
      createdAt: r.created_at, updatedAt: r.updated_at
    })));
  } catch { res.status(500).json({ error: 'Failed to load organizations' }); }
});

durableApiRouter.post('/organizations', requireRoles(['PNGEE_SUPER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  const { name, domain, contactEmail, plan, maxAssets } = req.body || {};
  if (!name || !domain || !contactEmail) return res.status(400).json({ error: 'Name, domain and contact email are required' });
  const id = `org-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
  const payload = { name, domain, contactEmail, plan: plan || 'PNGEE_BUSINESS', maxAssets: maxAssets || 50 };
  try {
    const result = await withSecurityContext(null, true, async client => {
      const r = await client.query(
        `INSERT INTO organizations (id,name,slug,domain,contact_email,plan,max_assets,payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [id, name, slug, domain, contactEmail, plan || 'PNGEE_BUSINESS', maxAssets || 50, JSON.stringify(payload)]
      );
      await audit(client, req, 'CREATE_ORGANIZATION', 'Organization', id, id, { name });
      return r.rows[0];
    });
    res.status(201).json(mergePayload(result, { id: result.id, name: result.name, slug: result.slug, domain: result.domain, contactEmail: result.contact_email, plan: result.plan, status: result.status, maxAssets: result.max_assets, assignedAnalysts: result.assigned_analysts, createdAt: result.created_at, updatedAt: result.updated_at }));
  } catch (error: any) { res.status(error?.code === '23505' ? 409 : 500).json({ error: 'Failed to create organization' }); }
});

durableApiRouter.put('/organizations/:id', requireRoles(['STK_SUPER_ADMIN', 'CUSTOMER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id;
  if (!isGlobal(req) && req.user!.organizationId !== id) return res.status(403).json({ error: 'Cross-tenant access denied' });
  try {
    const result = await withSecurityContext(isGlobal(req) ? null : req.user!.organizationId, isGlobal(req), async client => {
      const current = await client.query(`SELECT * FROM organizations WHERE id=$1`, [id]);
      if (!current.rowCount) return null;
      const row = current.rows[0];
      const next = { ...(row.payload || {}), ...req.body };
      const updated = await client.query(`UPDATE organizations SET name=COALESCE($2,name), domain=COALESCE($3,domain), contact_email=COALESCE($4,contact_email), plan=COALESCE($5,plan), max_assets=COALESCE($6,max_assets), payload=$7, updated_at=now() WHERE id=$1 RETURNING *`, [id, req.body.name, req.body.domain, req.body.contactEmail, req.body.plan, req.body.maxAssets, JSON.stringify(next)]);
      await audit(client, req, 'UPDATE_ORGANIZATION', 'Organization', id, id, req.body);
      return updated.rows[0];
    });
    if (!result) return res.status(404).json({ error: 'Organization not found' });
    res.json(mergePayload(result, { id: result.id, name: result.name, slug: result.slug, domain: result.domain, contactEmail: result.contact_email, plan: result.plan, status: result.status, maxAssets: result.max_assets, assignedAnalysts: result.assigned_analysts, createdAt: result.created_at, updatedAt: result.updated_at }));
  } catch { res.status(500).json({ error: 'Failed to update organization' }); }
});

// Users: reads are durable; creation requires an explicit password and never creates a usable default password.
durableApiRouter.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await withSecurityContext(contextOrg(req), isGlobal(req), client => client.query(`SELECT id,organization_id,name,email,role,avatar_url,phone,mfa_enabled,status,last_login_at,last_login_ip,created_at,updated_at FROM users ORDER BY name ASC`));
    res.json(rows.rows.map((r: any) => ({ id:r.id, organizationId:r.organization_id, name:r.name, email:r.email, role:r.role, avatarUrl:r.avatar_url || undefined, phone:r.phone || undefined, mfaEnabled:Boolean(r.mfa_enabled), status:r.status, lastLoginAt:r.last_login_at || undefined, lastLoginIp:r.last_login_ip || undefined, createdAt:r.created_at, updatedAt:r.updated_at })));
  } catch { res.status(500).json({ error: 'Failed to load users' }); }
});

durableApiRouter.post('/users', requireRoles(['STK_SUPER_ADMIN', 'CUSTOMER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  const { name, email, role, organizationId, password } = req.body || {};
  if (!name || !email || !role || !password) return res.status(400).json({ error: 'Name, email, role and password are required' });
  const targetOrg = isGlobal(req) ? (organizationId || req.user!.organizationId) : req.user!.organizationId;
  if (!targetOrg) return res.status(400).json({ error: 'Organization is required' });
  try {
    const id = `usr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const passwordHash = await hashPassword(password);
    const row = await withSecurityContext(targetOrg, isGlobal(req), async client => {
      const result = await client.query(`INSERT INTO users (id,organization_id,email,name,password_hash,role,status,mfa_enabled) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE',false) RETURNING id,organization_id,name,email,role,avatar_url,phone,mfa_enabled,status,created_at,updated_at`, [id,targetOrg,email.trim().toLowerCase(),name,passwordHash,role]);
      await audit(client, req, 'CREATE_USER', 'User', id, targetOrg, { email: email.trim().toLowerCase(), role });
      return result.rows[0];
    });
    res.status(201).json({ id:row.id, organizationId:row.organization_id, name:row.name, email:row.email, role:row.role, mfaEnabled:false, status:row.status, createdAt:row.created_at, updatedAt:row.updated_at });
  } catch (error:any) { res.status(error?.code === '23505' ? 409 : 500).json({ error: error?.code === '23505' ? 'Email already exists' : 'Failed to create user' }); }
});

// Assets: durable inventory with PostgreSQL tenant filtering/RLS.
durableApiRouter.get('/assets', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const params: any[] = [];
    const where: string[] = [];
    if (req.query.type) { params.push(req.query.type); where.push(`asset_type=$${params.length}`); }
    if (req.query.status) { params.push(req.query.status); where.push(`status=$${params.length}`); }
    if (req.query.criticality) { params.push(req.query.criticality); where.push(`criticality=$${params.length}`); }
    const rows = await withSecurityContext(contextOrg(req), isGlobal(req), client => client.query(`SELECT * FROM assets ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY last_seen DESC NULLS LAST, created_at DESC`, params));
    res.json(rows.rows.map((r:any) => mergePayload(r, { id:r.id, organizationId:r.organization_id, hostname:r.hostname, ipAddress:r.ip_address, macAddress:r.mac_address, operatingSystem:r.operating_system, osVersion:r.os_version, assetType:r.asset_type, criticality:r.criticality, status:r.status, agentStatus:r.agent_status, agentVersion:r.agent_version, securityStatus:r.security_status, telemetry:r.telemetry, tags:r.tags, notes:r.notes, lastSeen:r.last_seen, createdAt:r.created_at, updatedAt:r.updated_at })));
  } catch { res.status(500).json({ error: 'Failed to load assets' }); }
});

durableApiRouter.post('/assets', requireRoles(['STK_SUPER_ADMIN', 'STK_SECURITY_ANALYST', 'CUSTOMER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  const { hostname, ipAddress, operatingSystem, osVersion, assetType, criticality, organizationId } = req.body || {};
  if (!hostname || !assetType) return res.status(400).json({ error: 'Hostname and Asset Type are required' });
  const targetOrg = isGlobal(req) ? (organizationId || req.user!.organizationId) : req.user!.organizationId;
  const id = `ast-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const now = new Date().toISOString();
  const payload = { ...req.body, id, organizationId: targetOrg, createdAt: now, updatedAt: now };
  try {
    const row = await withSecurityContext(targetOrg, isGlobal(req), async client => {
      const r = await client.query(`INSERT INTO assets (id,organization_id,hostname,ip_address,operating_system,os_version,asset_type,criticality,status,agent_status,agent_version,security_status,telemetry,tags,notes,last_seen,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ONLINE','ACTIVE',$9,'SECURE',$10,$11,$12,$13,$14) RETURNING *`, [id,targetOrg,hostname,ipAddress || null,operatingSystem || 'Unknown OS',osVersion || '1.0',assetType,criticality || 'MEDIUM',req.body.agentVersion || null,JSON.stringify(req.body.telemetry || {}),JSON.stringify(req.body.tags || []),req.body.notes || '',now,JSON.stringify(payload)]);
      await audit(client, req, 'CREATE_ASSET', 'Asset', id, targetOrg, { hostname });
      return r.rows[0];
    });
    res.status(201).json(mergePayload(row, { id:row.id, organizationId:row.organization_id, hostname:row.hostname, ipAddress:row.ip_address, operatingSystem:row.operating_system, osVersion:row.os_version, assetType:row.asset_type, criticality:row.criticality, status:row.status, agentStatus:row.agent_status, agentVersion:row.agent_version, securityStatus:row.security_status, telemetry:row.telemetry, tags:row.tags, notes:row.notes, lastSeen:row.last_seen, createdAt:row.created_at, updatedAt:row.updated_at }));
  } catch (error:any) { res.status(error?.code === '23503' ? 400 : 500).json({ error:'Failed to create asset' }); }
});

// Enrollment tokens: raw secrets are returned only at creation time; the database stores a SHA-256 hash.
durableApiRouter.get('/assets/enrollment-tokens', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rows = await withSecurityContext(contextOrg(req), isGlobal(req), client => client.query(`SELECT id,organization_id,name,os_target,created_by,expires_at,max_uses,used_count,revoked_at,created_at,payload FROM enrollment_tokens ORDER BY created_at DESC`));
    res.json(rows.rows.map((r:any) => mergePayload(r,{id:r.id,organizationId:r.organization_id,name:r.name,osTarget:r.os_target,createdBy:r.created_by,expiresAt:r.expires_at,maxUses:r.max_uses,usedCount:r.used_count,isRevoked:Boolean(r.revoked_at),createdAt:r.created_at})));
  } catch { res.status(500).json({ error:'Failed to load enrollment tokens' }); }
});

durableApiRouter.post('/assets/enrollment-tokens', requireRoles(['STK_SUPER_ADMIN','CUSTOMER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  const targetOrg = isGlobal(req) ? (req.body.organizationId || req.user!.organizationId) : req.user!.organizationId;
  const rawToken = `stk_${crypto.randomBytes(24).toString('base64url')}`;
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const id = `tok-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const expiresAt = new Date(Date.now()+90*24*60*60*1000).toISOString();
  try {
    const row = await withSecurityContext(targetOrg, isGlobal(req), async client => {
      const r = await client.query(`INSERT INTO enrollment_tokens (id,organization_id,token_hash,name,os_target,created_by,expires_at,max_uses,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,100,$8) RETURNING id,organization_id,name,os_target,created_by,expires_at,max_uses,used_count,created_at`, [id,targetOrg,tokenHash,req.body.name || 'Endpoint Auto-Enrollment Key',req.body.osTarget || 'all',req.user!.id,expiresAt,JSON.stringify({ issuedAt:new Date().toISOString() })]);
      await audit(client, req, 'CREATE_ENROLLMENT_TOKEN', 'EnrollmentToken', id, targetOrg, { name:req.body.name || 'Endpoint Auto-Enrollment Key' });
      return r.rows[0];
    });
    res.status(201).json({ id:row.id, organizationId:row.organization_id, tokenKey:rawToken, name:row.name, osTarget:row.os_target, createdBy:req.user!.name, expiresAt:row.expires_at, isRevoked:false, usedCount:row.used_count, maxUses:row.max_uses, createdAt:row.created_at });
  } catch { res.status(500).json({ error:'Failed to create enrollment token' }); }
});

durableApiRouter.post('/assets/enrollment-tokens/:id/revoke', requireRoles(['STK_SUPER_ADMIN','CUSTOMER_ADMIN']) as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const row = await withSecurityContext(contextOrg(req), isGlobal(req), async client => {
      const current = await client.query(`SELECT * FROM enrollment_tokens WHERE id=$1`, [req.params.id]);
      if (!current.rowCount) return null;
      const updated = await client.query(`UPDATE enrollment_tokens SET revoked_at=now() WHERE id=$1 RETURNING id,organization_id,name,os_target,created_by,expires_at,max_uses,used_count,revoked_at,created_at`, [req.params.id]);
      await audit(client, req, 'REVOKE_ENROLLMENT_TOKEN', 'EnrollmentToken', req.params.id, updated.rows[0].organization_id);
      return updated.rows[0];
    });
    if (!row) return res.status(404).json({ error:'Token not found' });
    res.json({ success:true, token:{id:row.id,organizationId:row.organization_id,name:row.name,osTarget:row.os_target,createdBy:row.created_by,expiresAt:row.expires_at,isRevoked:true,usedCount:row.used_count,maxUses:row.max_uses,createdAt:row.created_at} });
  } catch { res.status(500).json({ error:'Failed to revoke enrollment token' }); }
});

// Events: durable ingestion endpoint. Detection correlation is intentionally a separate phase; this route never writes to the legacy store.
durableApiRouter.get('/events', async (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100),1),1000);
  try {
    const params:any[]=[]; const where:string[]=[];
    if(req.query.category){params.push(req.query.category);where.push(`event_type=$${params.length}`);}
    if(req.query.severity){params.push(req.query.severity);where.push(`severity=$${params.length}`);}
    params.push(limit);
    const rows=await withSecurityContext(contextOrg(req),isGlobal(req),client=>client.query(`SELECT * FROM security_events ${where.length?`WHERE ${where.join(' AND ')}`:''} ORDER BY occurred_at DESC LIMIT $${params.length}`,params));
    res.json(rows.rows.map((r:any)=>mergePayload(r,{id:r.id,organizationId:r.organization_id,assetId:r.asset_id || undefined,eventCategory:r.event_type,severity:r.severity,source:r.source,host:r.hostname,username:r.username,metadata:r.metadata,timestamp:r.occurred_at,createdTimestamp:r.created_at,integrityHash:r.integrity_hash,status:'PROCESSED'})));
  } catch { res.status(500).json({error:'Failed to load events'}); }
});

durableApiRouter.post('/events/ingest', async (req: AuthenticatedRequest, res: Response) => {
  const targetOrg = isGlobal(req) ? (req.body.organizationId || req.user!.organizationId) : req.user!.organizationId;
  const {source,eventCategory,eventDescription,severity,sourceType,sourceIP,destinationIP,username,host,mitreTechnique,assetId}=req.body||{};
  if(!source||!eventCategory||!eventDescription)return res.status(400).json({error:'Source, category, and event description are required.'});
  const id=`evt-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
  const timestamp=new Date().toISOString();
  const metadata={...req.body,sourceType:sourceType||'FIREWALL',sourceIP,destinationIP,mitreTechnique,eventDescription};
  try{
    const row=await withSecurityContext(targetOrg,isGlobal(req),async client=>{
      const r=await client.query(`INSERT INTO security_events (id,organization_id,asset_id,event_type,severity,source,hostname,username,metadata,occurred_at,created_at,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11) RETURNING *`,[id,targetOrg,assetId||null,eventCategory,severity||'MEDIUM',source,host||null,username||null,JSON.stringify(metadata),timestamp,JSON.stringify({id,organizationId:targetOrg,timestamp,source,eventCategory,eventDescription,severity:severity||'MEDIUM',sourceType:sourceType||'FIREWALL',sourceIP,destinationIP,username,host,mitreTechnique,assetId,status:'PROCESSED',createdTimestamp:timestamp})]);
      await audit(client,req,'INGEST_SECURITY_EVENT','SecurityEvent',id,targetOrg,{source,eventCategory,severity:severity||'MEDIUM'});
      return r.rows[0];
    });
    const event=mergePayload(row,{id:row.id,organizationId:row.organization_id,assetId:row.asset_id||undefined,eventCategory:row.event_type,severity:row.severity,source:row.source,host:row.hostname,username:row.username,metadata:row.metadata,timestamp:row.occurred_at,createdTimestamp:row.created_at,status:'PROCESSED'});
    res.status(201).json({event});
  }catch{res.status(500).json({error:'Failed to ingest security event'});}
});

// Alerts and incidents are fully durable for reads/status updates; creation is reserved for the detection pipeline.
durableApiRouter.get('/alerts', async (req: AuthenticatedRequest,res:Response)=>{
  try{const p:any[]=[];const w:string[]=[];if(req.query.status){p.push(req.query.status);w.push(`status=$${p.length}`);}if(req.query.severity){p.push(req.query.severity);w.push(`severity=$${p.length}`);}const rows=await withSecurityContext(contextOrg(req),isGlobal(req),c=>c.query(`SELECT * FROM alerts ${w.length?`WHERE ${w.join(' AND ')}`:''} ORDER BY last_seen DESC LIMIT 1000`,p));res.json(rows.rows.map((r:any)=>mergePayload(r,{id:r.id,organizationId:r.organization_id,assetId:r.asset_id||undefined,severity:r.severity,status:r.status,title:r.title,description:r.description,detectionRuleId:r.rule_id,occurrenceCount:r.occurrence_count,timestamp:r.first_seen,lastSeenTimestamp:r.last_seen,createdAt:r.created_at})));}catch{res.status(500).json({error:'Failed to load alerts'});}
});

durableApiRouter.put('/alerts/:id/status', async(req:AuthenticatedRequest,res:Response)=>{
  const status=String(req.body?.status||'').trim();if(!status)return res.status(400).json({error:'Status is required'});
  try{const row=await withSecurityContext(contextOrg(req),isGlobal(req),async c=>{const r=await c.query(`UPDATE alerts SET status=$2,last_seen=now(),payload=payload || $3::jsonb WHERE id=$1 RETURNING *`,[req.params.id,status,JSON.stringify({analystNote:req.body.note||undefined})]);if(!r.rowCount)return null;await audit(c,req,'UPDATE_ALERT_STATUS','SecurityAlert',req.params.id,r.rows[0].organization_id,{status,note:req.body.note});return r.rows[0];});if(!row)return res.status(404).json({error:'Alert not found'});res.json(mergePayload(row,{id:row.id,organizationId:row.organization_id,assetId:row.asset_id||undefined,severity:row.severity,status:row.status,title:row.title,description:row.description,detectionRuleId:row.rule_id,occurrenceCount:row.occurrence_count,timestamp:row.first_seen,lastSeenTimestamp:row.last_seen,createdAt:row.created_at}));}catch{res.status(500).json({error:'Failed to update alert'});}
});

durableApiRouter.get('/incidents',async(req:AuthenticatedRequest,res:Response)=>{try{const rows=await withSecurityContext(contextOrg(req),isGlobal(req),c=>c.query(`SELECT * FROM incidents ORDER BY updated_at DESC LIMIT 1000`));res.json(rows.rows.map((r:any)=>mergePayload(r,{id:r.id,organizationId:r.organization_id,title:r.title,status:r.status,severity:r.severity,relatedAlertIds:r.related_alert_ids,createdAt:r.created_at,updatedAt:r.updated_at})));}catch{res.status(500).json({error:'Failed to load incidents'});}});

durableApiRouter.post('/incidents',requireRoles(['STK_SUPER_ADMIN','STK_SECURITY_ANALYST','CUSTOMER_ADMIN']) as any,async(req:AuthenticatedRequest,res:Response)=>{const targetOrg=isGlobal(req)?(req.body.organizationId||req.user!.organizationId):req.user!.organizationId;const id=`inc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;const now=new Date().toISOString();try{const row=await withSecurityContext(targetOrg,isGlobal(req),async c=>{const r=await c.query(`INSERT INTO incidents (id,organization_id,title,status,severity,related_alert_ids,payload,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING *`,[id,targetOrg,req.body.title||'Security Incident',req.body.status||'DETECTED',req.body.severity||'HIGH',JSON.stringify(req.body.relatedAlertIds||[]),JSON.stringify(req.body),now]);await audit(c,req,'CREATE_INCIDENT','SecurityIncident',id,targetOrg,{title:req.body.title});return r.rows[0];});res.status(201).json(mergePayload(row,{id:row.id,organizationId:row.organization_id,title:row.title,status:row.status,severity:row.severity,relatedAlertIds:row.related_alert_ids,createdAt:row.created_at,updatedAt:row.updated_at}));}catch{res.status(500).json({error:'Failed to create incident'});}});

durableApiRouter.put('/incidents/:id',async(req:AuthenticatedRequest,res:Response)=>{try{const row=await withSecurityContext(contextOrg(req),isGlobal(req),async c=>{const current=await c.query(`SELECT * FROM incidents WHERE id=$1`,[req.params.id]);if(!current.rowCount)return null;const next={...(current.rows[0].payload||{}),...req.body};const r=await c.query(`UPDATE incidents SET status=COALESCE($2,status),severity=COALESCE($3,severity),payload=$4,updated_at=now() WHERE id=$1 RETURNING *`,[req.params.id,req.body.status,req.body.severity,JSON.stringify(next)]);await audit(c,req,'UPDATE_INCIDENT','SecurityIncident',req.params.id,r.rows[0].organization_id,req.body);return r.rows[0];});if(!row)return res.status(404).json({error:'Incident not found'});res.json(mergePayload(row,{id:row.id,organizationId:row.organization_id,title:row.title,status:row.status,severity:row.severity,relatedAlertIds:row.related_alert_ids,createdAt:row.created_at,updatedAt:row.updated_at}));}catch{res.status(500).json({error:'Failed to update incident'});}});

// Audit trail is always sourced from PostgreSQL.
durableApiRouter.get('/audit-logs',async(req:AuthenticatedRequest,res:Response)=>{try{const rows=await withSecurityContext(contextOrg(req),isGlobal(req),c=>c.query(`SELECT a.*,u.name AS actor_name,u.email AS actor_email,o.name AS organization_name FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id LEFT JOIN organizations o ON o.id=a.organization_id ORDER BY a.created_at DESC LIMIT 1000`));res.json(rows.rows.map((r:any)=>({id:r.id,timestamp:r.created_at,actor:r.actor_name||'System',actorEmail:r.actor_email||undefined,organizationId:r.organization_id||undefined,organizationName:r.organization_name||undefined,action:r.action,resource:r.resource,resourceId:r.resource_id||undefined,sourceIP:r.ip_address||undefined,result:r.result,details:r.details})));}catch{res.status(500).json({error:'Failed to load audit logs'});}});

// Detection rules are now durable and tenant-aware.
durableApiRouter.get('/detection-rules',async(req:AuthenticatedRequest,res:Response)=>{try{const rows=await withSecurityContext(contextOrg(req),isGlobal(req),c=>c.query(`SELECT * FROM detection_rules ORDER BY created_at DESC`));res.json(rows.rows.map((r:any)=>mergePayload(r,{id:r.id,organizationScope:r.organization_id||'GLOBAL',name:r.name,enabled:r.enabled,category:r.category,severity:r.severity,createdAt:r.created_at,updatedAt:r.updated_at})));}catch{res.status(500).json({error:'Failed to load detection rules'});}});

durableApiRouter.post('/detection-rules',requireRoles(['STK_SUPER_ADMIN']) as any,async(req:AuthenticatedRequest,res:Response)=>{const id=`rule-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;const orgId=req.body.organizationScope&&req.body.organizationScope!=='GLOBAL'?req.body.organizationScope:null;try{const row=await withSecurityContext(orgId,true,async c=>{const r=await c.query(`INSERT INTO detection_rules (id,organization_id,name,enabled,category,severity,payload) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[id,orgId,req.body.name||'Detection Rule',req.body.enabled!==false,req.body.category||'Endpoint',req.body.severity||'HIGH',JSON.stringify(req.body)]);await audit(c,req,'CREATE_DETECTION_RULE','DetectionRule',id,orgId,{name:req.body.name});return r.rows[0];});res.status(201).json(mergePayload(row,{id:row.id,organizationScope:row.organization_id||'GLOBAL',name:row.name,enabled:row.enabled,category:row.category,severity:row.severity,createdAt:row.created_at,updatedAt:row.updated_at}));}catch{res.status(500).json({error:'Failed to create detection rule'});}});

durableApiRouter.post('/detection-rules/:id/toggle',requireRoles(['STK_SUPER_ADMIN']) as any,async(req:AuthenticatedRequest,res:Response)=>{try{const row=await withSecurityContext(null,true,async c=>{const r=await c.query(`UPDATE detection_rules SET enabled=NOT enabled,updated_at=now() WHERE id=$1 RETURNING *`,[req.params.id]);if(!r.rowCount)return null;await audit(c,req,'TOGGLE_DETECTION_RULE','DetectionRule',req.params.id,r.rows[0].organization_id,{enabled:r.rows[0].enabled});return r.rows[0];});if(!row)return res.status(404).json({error:'Rule not found'});res.json(mergePayload(row,{id:row.id,organizationScope:row.organization_id||'GLOBAL',name:row.name,enabled:row.enabled,category:row.category,severity:row.severity,createdAt:row.created_at,updatedAt:row.updated_at}));}catch{res.status(500).json({error:'Failed to toggle detection rule'});}});

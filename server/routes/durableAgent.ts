import { Router, Request, Response, NextFunction } from 'express';
import { DurableAgentService, AgentContext } from '../services/durableAgentService';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { withSecurityContext } from '../db/postgres';

export const durableAgentRouter = Router();

const ip=(req:Request)=>(req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()||req.socket.remoteAddress||'127.0.0.1';
const ctx=(req:Request)=>(req as any).agentContext as AgentContext;
const canonical=(req:Request)=>`${req.headers['x-timestamp']||''}\n${req.method}\n${req.path}\n${JSON.stringify(req.body??{})}`;

async function agentAuth(req:Request,res:Response,next:NextFunction){
  try{
    const c=await DurableAgentService.authenticate(String(req.headers['x-agent-id']||''),String(req.headers['x-agent-key']||''),String(req.headers['x-timestamp']||''),String(req.headers['x-agent-signature']||''),canonical(req));
    await DurableAgentService.claimRequest(c,String(req.headers['x-request-id']||''));
    (req as any).agentContext=c; next();
  }catch(error:any){res.status(401).json({error:'Unauthorized Agent',message:error?.message||'Agent authentication failed'});}
}

durableAgentRouter.post('/agent/enroll',async(req,res)=>{try{const result=await DurableAgentService.enroll({...req.body,ipAddress:ip(req)});res.status(201).json(result);}catch(error:any){res.status(400).json({error:'Enrollment Failed',message:error?.message||'Invalid enrollment payload or token'});}});

durableAgentRouter.post('/telemetry/heartbeat',agentAuth,async(req,res)=>{try{await DurableAgentService.heartbeat(ctx(req),ip(req));res.json({status:'ACKNOWLEDGED',timestamp:new Date().toISOString(),nextHeartbeatSeconds:30});}catch(error:any){res.status(500).json({error:'Telemetry persistence failed'});}});

durableAgentRouter.post('/telemetry/system',agentAuth,async(req,res)=>{try{await DurableAgentService.system(ctx(req),req.body||{},ip(req));res.json({status:'RECORDED',timestamp:new Date().toISOString()});}catch(error:any){res.status(500).json({error:'Telemetry persistence failed'});}});

durableAgentRouter.post('/telemetry/security',agentAuth,async(req,res)=>{try{await DurableAgentService.security(ctx(req),req.body||{},ip(req));res.json({status:'RECORDED',timestamp:new Date().toISOString()});}catch(error:any){res.status(500).json({error:'Telemetry persistence failed'});}});

durableAgentRouter.post('/telemetry/events',agentAuth,async(req,res)=>{try{const events=Array.isArray(req.body)?req.body:[req.body];const ids:string[]=[];for(const evt of events)ids.push(await DurableAgentService.event(ctx(req),evt||{},ip(req)));res.json({status:'INGESTED',count:ids.length,eventIds:ids});}catch(error:any){res.status(500).json({error:'Telemetry persistence failed'});}});

durableAgentRouter.get('/telemetry/normalized-events',authMiddleware as any,async(req:AuthenticatedRequest,res:Response)=>{try{const org=req.user!.organizationId,limit=Math.min(Math.max(Number(req.query.limit)||100,1),500),asset=typeof req.query.assetId==='string'?req.query.assetId:undefined;const result=await withSecurityContext(org,false,c=>asset?c.query(`SELECT id AS event_id,organization_id,asset_id,occurred_at AS timestamp,source,event_type,severity,hostname,username,metadata,integrity_hash FROM security_events WHERE organization_id=$1 AND asset_id=$2 ORDER BY occurred_at DESC LIMIT $3`,[org,asset,limit]):c.query(`SELECT id AS event_id,organization_id,asset_id,occurred_at AS timestamp,source,event_type,severity,hostname,username,metadata,integrity_hash FROM security_events WHERE organization_id=$1 ORDER BY occurred_at DESC LIMIT $2`,[org,limit]));res.json({events:result.rows,totalCount:result.rowCount});}catch(error:any){res.status(500).json({error:'Failed to load telemetry'});}});

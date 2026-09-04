import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { durablePlatformRouter } from './server/routes/durablePlatform';
import { durableApiRouter } from './server/routes/durableApi';
import { durableIngestRouter } from './server/routes/durableIngest';
import { durableAgentRouter } from './server/routes/durableAgent';
import authRouter from './server/routes/auth';
import { securityHeaders, apiRateLimit, rejectInsecureProductionRequests } from './server/middleware/security';
import { healthCheck } from './server/db/postgres';

async function startServer(){
  if(process.env.NODE_ENV==='production'&&!process.env.DATABASE_URL)throw new Error('Production startup blocked: DATABASE_URL is required for PNGee CyberGuard v3.');
  if(process.env.NODE_ENV==='production'&&(!process.env.AUTH_SECRET||process.env.AUTH_SECRET.length<32))throw new Error('Production startup blocked: AUTH_SECRET must be configured with at least 32 characters.');
  const app=express(),PORT=Number(process.env.PORT||3000);
  app.set('trust proxy',Number(process.env.TRUST_PROXY||0));app.disable('x-powered-by');
  app.use(securityHeaders);app.use(rejectInsecureProductionRequests);app.use(apiRateLimit);
  app.use(express.json({limit:'1mb'}));app.use(express.urlencoded({extended:true,limit:'1mb'}));app.use(cookieParser());
  app.get('/api/health',async(_req,res)=>{try{const database=await healthCheck();res.status(database?200:503).json({status:database?'ok':'degraded',database:database?'healthy':'unhealthy',timestamp:new Date().toISOString()});}catch{res.status(503).json({status:'degraded',database:'unhealthy',timestamp:new Date().toISOString()});}});

  app.use('/api/v1/auth',authRouter);
  app.use('/api/v1',durableAgentRouter);app.use('/api',durableAgentRouter);
  app.use('/api/v1',durableIngestRouter);app.use('/api',durableIngestRouter);
  // All customer/business APIs are now database-backed. The legacy in-memory API is intentionally not mounted.
  app.use('/api/v1',durablePlatformRouter);app.use('/api',durablePlatformRouter);
  app.use('/api/v1',durableApiRouter);app.use('/api',durableApiRouter);

  if(process.env.NODE_ENV!=='production'){
    const vite=await createViteServer({server:{middlewareMode:true,host:'0.0.0.0',port:PORT},appType:'spa'});app.use(vite.middlewares);
  }else{
    const distPath=path.join(process.cwd(),'dist');app.use(express.static(distPath,{index:false}));app.get('*',(req,res)=>res.sendFile(path.join(distPath,'index.html')));
  }
  app.listen(PORT,'0.0.0.0',()=>console.log(`PNGee CyberGuard listening on port ${PORT}; production traffic must use HTTPS.`));
}
startServer().catch(err=>{console.error('Failed to start PNGee CyberGuard:',err);process.exit(1);});

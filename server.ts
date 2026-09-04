import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api';
import { durableApiRouter } from './server/routes/durableApi';
import { durableIngestRouter } from './server/routes/durableIngest';
import authRouter from './server/routes/auth';
import { agentRouter } from './server/routes/agent';
import { AgentService } from './server/services/agentService';
import { securityHeaders, apiRateLimit, rejectInsecureProductionRequests } from './server/middleware/security';
import { healthCheck } from './server/db/postgres';

async function startServer() {
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) throw new Error('Production startup blocked: DATABASE_URL is required for PNGee CyberGuard v3.');
  if (process.env.NODE_ENV === 'production' && (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)) throw new Error('Production startup blocked: AUTH_SECRET must be configured with at least 32 characters.');

  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(rejectInsecureProductionRequests);
  app.use(apiRateLimit);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  app.use((req, res, next) => { if (req.path.startsWith('/api/')) console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`); next(); });

  app.get('/api/health', async (_req, res) => {
    try { const database = await healthCheck(); res.status(database ? 200 : 503).json({ status: database ? 'ok' : 'degraded', service: 'PNGee CyberGuard Managed Cybersecurity Platform', database: database ? 'healthy' : 'unhealthy', timestamp: new Date().toISOString() }); }
    catch { res.status(503).json({ status: 'degraded', database: 'unhealthy', timestamp: new Date().toISOString() }); }
  });

  // Authentication is intentionally mounted before protected business APIs.
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', agentRouter);
  app.use('/api', agentRouter);
  // Durable PostgreSQL-backed routes take precedence over the legacy in-memory compatibility router.
  app.use('/api/v1', durableIngestRouter);
  app.use('/api', durableIngestRouter);
  app.use('/api/v1', durableApiRouter);
  app.use('/api', durableApiRouter);
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  setInterval(() => { try { AgentService.checkHeartbeatTimeouts(); } catch (err) { console.error('[Watchdog] Error during heartbeat evaluation:', err); } }, 30000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true, host: '0.0.0.0', port: PORT }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`PNGee CyberGuard listening on port ${PORT}; production traffic must use HTTPS.`));
}

startServer().catch(err => { console.error('Failed to start PNGee CyberGuard server:', err); process.exit(1); });

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api';
import { agentRouter } from './server/routes/agent';
import { AgentService } from './server/services/agentService';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parser middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logger for auditability
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    }
    next();
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'PNGee CyberGuard Managed Cybersecurity Platform', timestamp: new Date().toISOString() });
  });

  // Mount Dedicated Agent Telemetry & Enrollment Router (exempt from user session auth)
  app.use('/api/v1', agentRouter);
  app.use('/api', agentRouter);

  // Mount Authenticated Core SOC & Tenant Management API Router
  app.use('/api/v1', apiRouter);
  app.use('/api', apiRouter);

  // Start Endpoint Heartbeat Watchdog Daemon (Runs every 30s)
  setInterval(() => {
    try {
      AgentService.checkHeartbeatTimeouts();
    } catch (err) {
      console.error('[Watchdog] Error during heartbeat evaluation:', err);
    }
  }, 30000);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: 3000 },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🛡️ PNGee CyberGuard SOC Platform running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start PNGee CyberGuard server:', err);
  process.exit(1);
});

import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { ingestAndCorrelateDurably } from '../services/durableDetectionEngine';

export const durableIngestRouter = Router();
durableIngestRouter.use(authMiddleware as any);

durableIngestRouter.post('/events/ingest', async (req: AuthenticatedRequest, res: Response) => {
  const global = ['PNGEE_SUPER_ADMIN','PNGEE_SECURITY_ANALYST','STK_SUPER_ADMIN','STK_SECURITY_ANALYST'].includes(req.user?.role || '');
  const organizationId = global ? (req.body?.organizationId || req.user?.organizationId) : req.user?.organizationId;
  if (!organizationId) return res.status(400).json({ error: 'Organization is required' });
  const { source, eventCategory, eventDescription } = req.body || {};
  if (!source || !eventCategory || !eventDescription) return res.status(400).json({ error: 'Source, category, and event description are required.' });
  try {
    const result = await ingestAndCorrelateDurably({
      organizationId,
      source,
      sourceType: req.body.sourceType,
      severity: req.body.severity,
      eventCategory,
      sourceIP: req.body.sourceIP,
      destinationIP: req.body.destinationIP,
      username: req.body.username,
      host: req.body.host,
      device: req.body.device,
      eventDescription,
      rawEventReference: req.body.rawEventReference,
      mitreTechnique: req.body.mitreTechnique,
      assetId: req.body.assetId
    });
    res.status(201).json(result);
  } catch (error) {
    console.error('[DurableIngest] event ingestion failed', error);
    res.status(500).json({ error: 'Failed to ingest security event' });
  }
});

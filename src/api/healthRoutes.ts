import { Router, Request, Response } from 'express';
import { logger } from '../infra/logger';

const router = Router();
const startTime = Date.now();

/**
 * Health check endpoint
 * GET /health
 * Returns service status, uptime, and timestamp
 */
router.get('/health', (req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000); // seconds

  res.json({
    status: 'ok',
    uptime,
    timestamp: new Date().toISOString(),
  });
});

export default router;


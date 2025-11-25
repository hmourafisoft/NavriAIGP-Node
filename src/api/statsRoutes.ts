import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../infra/logger';
import { getOverviewStats } from '../core/statsService';

const router = Router();

/**
 * Validation schema for stats overview query parameters
 */
const overviewStatsSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  environment: z.string().optional(),
  from: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
  to: z.string().datetime().optional().transform((val) => val ? new Date(val) : undefined),
});

/**
 * GET /stats/overview
 * Get overview statistics for a tenant
 * 
 * Query parameters:
 * - tenantId (required): Tenant/organization ID
 * - environment (optional): Filter by environment (dev/hml/prod)
 * - from (optional): Start date in ISO format (default: 7 days ago)
 * - to (optional): End date in ISO format (default: now)
 * 
 * Example:
 *   GET /stats/overview?tenantId=tenant-local&environment=hml
 *   GET /stats/overview?tenantId=tenant-local&from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z
 */
router.get('/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    // Parse and validate query parameters
    const parsed = overviewStatsSchema.parse({
      tenantId: req.query.tenantId,
      environment: req.query.environment,
      from: req.query.from,
      to: req.query.to,
    });

    logger.info('Stats overview request', {
      tenantId: parsed.tenantId,
      environment: parsed.environment,
      from: parsed.from?.toISOString(),
      to: parsed.to?.toISOString(),
    });

    // Get statistics
    const stats = await getOverviewStats({
      tenantId: parsed.tenantId,
      environment: parsed.environment,
      from: parsed.from,
      to: parsed.to,
    });

    res.status(200).json(stats);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid query parameters for /stats/overview', { errors: error.errors });
      res.status(400).json({
        error: 'validation_error',
        message: 'Invalid query parameters',
        details: error.errors,
      });
      return;
    }

    logger.error('Failed to get overview stats', error);
    res.status(500).json({
      error: 'internal_error',
      message: 'Unable to calculate statistics',
    });
  }
});

export default router;


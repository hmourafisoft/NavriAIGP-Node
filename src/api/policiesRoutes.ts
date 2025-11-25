import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../infra/logger';
import { decide } from '../core/policyEngine';
import { query } from '../infra/db';

const router = Router();

/**
 * Validation schemas using Zod
 */
const decideSchema = z.object({
  tenantId: z.string().min(1),
  useCaseId: z.string().optional(),
  intentName: z.string().optional(),
  environment: z.string().optional(),
  riskLevel: z.string().optional(),
  agentId: z.string().optional(),
  model: z.string().optional(),
  dataSensitivity: z.string().optional(),
});

const importPoliciesSchema = z.object({
  tenantId: z.string().min(1),
  version: z.string(),
  rules: z.array(
    z.object({
      name: z.string().min(1),
      priority: z.number().int(),
      match: z.record(z.any()),
      decision: z.object({
        effect: z.enum(['allow', 'deny', 'require_approval', 'override_model', 'override_agent']),
        overrideModel: z.string().optional(),
        overrideAgent: z.string().optional(),
        reason: z.string().optional(),
      }),
    })
  ),
});

/**
 * POST /policies/decide
 * Make a policy decision based on input criteria
 */
router.post('/decide', async (req: Request, res: Response) => {
  try {
    const body = decideSchema.parse(req.body);
    
    const decision = await decide({
      tenantId: body.tenantId,
      useCaseId: body.useCaseId,
      intentName: body.intentName,
      environment: body.environment,
      riskLevel: body.riskLevel,
      agentId: body.agentId,
      model: body.model,
      dataSensitivity: body.dataSensitivity,
    });

    res.json(decision);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request body for /policies/decide', { errors: error.errors });
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    logger.error('Failed to make policy decision', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /policies/import
 * Import policies for a tenant
 * 
 * This endpoint:
 * 1. Deletes existing policies for the tenant (or marks them as inactive)
 * 2. Inserts the new policies
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const body = importPoliciesSchema.parse(req.body);
    
    // Start a transaction-like operation
    // For simplicity, we'll delete old policies and insert new ones
    // In production, you might want to use actual transactions
    
    logger.info('Importing policies', {
      tenantId: body.tenantId,
      version: body.version,
      ruleCount: body.rules.length,
    });

    // Delete existing policies for this tenant
    await query('DELETE FROM policies WHERE tenant_id = $1', [body.tenantId]);

    // Insert new policies
    const insertPromises = body.rules.map((rule) => {
      const policyId = randomUUID();
      return query(
        `INSERT INTO policies (id, tenant_id, name, priority, match, decision, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          policyId,
          body.tenantId,
          rule.name,
          rule.priority,
          JSON.stringify(rule.match),
          JSON.stringify(rule.decision),
        ]
      );
    });

    await Promise.all(insertPromises);

    logger.info('Policies imported successfully', {
      tenantId: body.tenantId,
      count: body.rules.length,
    });

    res.status(201).json({
      success: true,
      tenantId: body.tenantId,
      version: body.version,
      importedCount: body.rules.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request body for /policies/import', { errors: error.errors });
      return res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
    }

    logger.error('Failed to import policies', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


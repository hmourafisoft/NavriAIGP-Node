import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../infra/logger';
import {
  startTrace,
  logModelCall,
  logAgentCall,
  logAuditEvent,
  endTrace,
} from '../core/traceService';
import { TraceStatus } from '../core/types';

const router = Router();

/**
 * Validation schemas using Zod
 */
const startTraceSchema = z.object({
  intentName: z.string().min(1),
  useCaseId: z.string().min(1),
  riskLevel: z.string().min(1),
  dataSensitivity: z.string().min(1),
  environment: z.string().min(1),
  tenantId: z.string().min(1),
  extra: z.record(z.any()).optional(),
});

const modelCallSchema = z.object({
  traceId: z.string().uuid(),
  provider: z.string().min(1),
  model: z.string().min(1),
  stepName: z.string().min(1),
  prompt: z.string(),
  response: z.string(),
  tokensInput: z.number().int().positive().optional(),
  tokensOutput: z.number().int().positive().optional(),
  latencyMs: z.number().int().nonnegative(),
});

const agentCallSchema = z.object({
  traceId: z.string().uuid(),
  agentId: z.string().min(1),
  domain: z.string().min(1),
  operation: z.string().min(1),
  request: z.record(z.any()),
  response: z.record(z.any()),
  statusCode: z.number().int(),
  latencyMs: z.number().int().nonnegative(),
});

const auditEventSchema = z.object({
  traceId: z.string().uuid(),
  eventType: z.string().min(1),
  payload: z.record(z.any()),
});

const endTraceSchema = z.object({
  traceId: z.string().uuid(),
  status: z.enum(['running', 'success', 'error', 'cancelled']),
  resultSummary: z.record(z.any()).optional(),
});

/**
 * POST /traces/start
 * Start a new trace
 */
router.post('/start', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = startTraceSchema.parse(req.body);
    
    const result = await startTrace({
      intentName: body.intentName,
      useCaseId: body.useCaseId,
      riskLevel: body.riskLevel,
      dataSensitivity: body.dataSensitivity,
      environment: body.environment,
      tenantId: body.tenantId,
      extra: body.extra,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request body for /traces/start', { errors: error.errors });
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Failed to start trace', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /traces/model-call
 * Log a model call
 */
router.post('/model-call', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = modelCallSchema.parse(req.body);
    
    await logModelCall(body.traceId, {
      provider: body.provider,
      model: body.model,
      stepName: body.stepName,
      prompt: body.prompt,
      response: body.response,
      tokensInput: body.tokensInput,
      tokensOutput: body.tokensOutput,
      latencyMs: body.latencyMs,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request body for /traces/model-call', { errors: error.errors });
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Failed to log model call', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /traces/agent-call
 * Log an agent call
 */
router.post('/agent-call', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = agentCallSchema.parse(req.body);
    
    await logAgentCall(body.traceId, {
      agentId: body.agentId,
      domain: body.domain,
      operation: body.operation,
      request: body.request,
      response: body.response,
      statusCode: body.statusCode,
      latencyMs: body.latencyMs,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request body for /traces/agent-call', { errors: error.errors });
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Failed to log agent call', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /traces/audit
 * Log an audit event
 */
router.post('/audit', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = auditEventSchema.parse(req.body);
    
    await logAuditEvent(body.traceId, {
      eventType: body.eventType,
      payload: body.payload,
    });

    res.status(201).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request body for /traces/audit', { errors: error.errors });
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Failed to log audit event', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /traces/end
 * End a trace
 */
router.post('/end', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = endTraceSchema.parse(req.body);
    
    await endTrace(body.traceId, body.status as TraceStatus, body.resultSummary);

    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid request body for /traces/end', { errors: error.errors });
      res.status(400).json({
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }

    logger.error('Failed to end trace', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;


import { randomUUID } from 'crypto';
import { query } from '../infra/db';
import { logger } from '../infra/logger';
import {
  TraceMeta,
  ModelCallLog,
  AgentCallLog,
  AuditEventLog,
  TraceStatus,
} from './types';

/**
 * Service for managing traces and logging governance events
 */

/**
 * Start a new trace
 * @param meta Trace metadata
 * @returns Trace ID
 */
export async function startTrace(meta: TraceMeta): Promise<{ traceId: string }> {
  const traceId = randomUUID();
  
  const insertQuery = `
    INSERT INTO traces (
      id, tenant_id, intent_name, use_case_id, risk_level,
      data_sensitivity, environment, created_at, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'running')
    RETURNING id
  `;

  try {
    await query(insertQuery, [
      traceId,
      meta.tenantId,
      meta.intentName,
      meta.useCaseId,
      meta.riskLevel,
      meta.dataSensitivity,
      meta.environment,
    ]);

    logger.info('Trace started', { traceId, intentName: meta.intentName, useCaseId: meta.useCaseId });

    return { traceId };
  } catch (error) {
    logger.error('Failed to start trace', error, { meta });
    throw error;
  }
}

/**
 * Log a model call
 * @param traceId Trace ID
 * @param log Model call log data
 */
export async function logModelCall(traceId: string, log: ModelCallLog): Promise<void> {
  const insertQuery = `
    INSERT INTO model_calls (
      id, trace_id, provider, model, step_name, prompt, response,
      tokens_input, tokens_output, latency_ms, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
  `;

  const modelCallId = randomUUID();

  try {
    await query(insertQuery, [
      modelCallId,
      traceId,
      log.provider,
      log.model,
      log.stepName,
      log.prompt.substring(0, 10000), // Truncate if too long
      log.response.substring(0, 10000), // Truncate if too long
      log.tokensInput ?? null,
      log.tokensOutput ?? null,
      log.latencyMs,
    ]);

    logger.debug('Model call logged', { traceId, modelCallId, provider: log.provider, model: log.model });
  } catch (error) {
    logger.error('Failed to log model call', error, { traceId, log });
    throw error;
  }
}

/**
 * Log an agent call
 * @param traceId Trace ID
 * @param log Agent call log data
 */
export async function logAgentCall(traceId: string, log: AgentCallLog): Promise<void> {
  const insertQuery = `
    INSERT INTO agent_calls (
      id, trace_id, agent_id, domain, operation, request, response,
      status_code, latency_ms, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
  `;

  const agentCallId = randomUUID();

  try {
    await query(insertQuery, [
      agentCallId,
      traceId,
      log.agentId,
      log.domain,
      log.operation,
      JSON.stringify(log.request),
      JSON.stringify(log.response),
      log.statusCode,
      log.latencyMs,
    ]);

    logger.debug('Agent call logged', { traceId, agentCallId, agentId: log.agentId, operation: log.operation });
  } catch (error) {
    logger.error('Failed to log agent call', error, { traceId, log });
    throw error;
  }
}

/**
 * Log an audit event
 * @param traceId Trace ID
 * @param log Audit event log data
 */
export async function logAuditEvent(traceId: string, log: AuditEventLog): Promise<void> {
  const insertQuery = `
    INSERT INTO audit_events (
      id, trace_id, event_type, payload, created_at
    )
    VALUES ($1, $2, $3, $4, NOW())
  `;

  const auditEventId = randomUUID();

  try {
    await query(insertQuery, [
      auditEventId,
      traceId,
      log.eventType,
      JSON.stringify(log.payload),
    ]);

    logger.debug('Audit event logged', { traceId, auditEventId, eventType: log.eventType });
  } catch (error) {
    logger.error('Failed to log audit event', error, { traceId, log });
    throw error;
  }
}

/**
 * End a trace
 * @param traceId Trace ID
 * @param status Trace status
 * @param resultSummary Optional result summary
 */
export async function endTrace(
  traceId: string,
  status: TraceStatus,
  resultSummary?: Record<string, any>
): Promise<void> {
  const updateQuery = `
    UPDATE traces
    SET ended_at = NOW(), status = $1, result_summary = $2
    WHERE id = $3
  `;

  try {
    await query(updateQuery, [
      status,
      resultSummary ? JSON.stringify(resultSummary) : null,
      traceId,
    ]);

    logger.info('Trace ended', { traceId, status });
  } catch (error) {
    logger.error('Failed to end trace', error, { traceId, status });
    throw error;
  }
}


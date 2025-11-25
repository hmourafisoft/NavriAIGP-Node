/**
 * Statistics service for observability
 * Provides aggregated statistics by tenant, environment, and use case
 */

import { query } from '../infra/db';
import { logger } from '../infra/logger';
import { StatsOverview, StatsOverviewInput, StatsSummary, UseCaseStats } from './types';

/**
 * Get overview statistics for a tenant
 * 
 * @param input Query parameters (tenantId, environment, date range)
 * @returns Aggregated statistics
 */
export async function getOverviewStats(input: StatsOverviewInput): Promise<StatsOverview> {
  const { tenantId, environment, from, to } = input;

  // Default to last 7 days if no date range provided
  const defaultTo = to || new Date();
  const defaultFrom = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  logger.info('Fetching overview stats', {
    tenantId,
    environment,
    from: defaultFrom.toISOString(),
    to: defaultTo.toISOString(),
  });

  try {
    // Build WHERE clause conditions
    const conditions: string[] = ['t.tenant_id = $1', 't.created_at >= $2', 't.created_at <= $3'];
    const params: any[] = [tenantId, defaultFrom, defaultTo];
    let paramIndex = 4;

    if (environment) {
      conditions.push(`t.environment = $${paramIndex}`);
      params.push(environment);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Query 1: Summary statistics (total counts)
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT t.id) as total_traces,
        COUNT(DISTINCT mc.id) as total_model_calls,
        COUNT(DISTINCT ac.id) as total_agent_calls
      FROM traces t
      LEFT JOIN model_calls mc ON mc.trace_id = t.id
      LEFT JOIN agent_calls ac ON ac.trace_id = t.id
      WHERE ${whereClause}
    `;

    const summaryResult = await query<{
      total_traces: string | number;
      total_model_calls: string | number;
      total_agent_calls: string | number;
    }>(summaryQuery, params);

    const row = summaryResult.rows[0];
    const summary: StatsSummary = {
      totalTraces: typeof row?.total_traces === 'number' ? row.total_traces : parseInt(String(row?.total_traces || '0'), 10),
      totalModelCalls: typeof row?.total_model_calls === 'number' ? row.total_model_calls : parseInt(String(row?.total_model_calls || '0'), 10),
      totalAgentCalls: typeof row?.total_agent_calls === 'number' ? row.total_agent_calls : parseInt(String(row?.total_agent_calls || '0'), 10),
    };

    // Query 2: Statistics by use case
    const byUseCaseQuery = `
      SELECT 
        t.use_case_id as use_case_id,
        COUNT(DISTINCT t.id) as traces,
        COUNT(DISTINCT mc.id) as model_calls,
        COUNT(DISTINCT ac.id) as agent_calls,
        MAX(t.created_at) as last_trace_at
      FROM traces t
      LEFT JOIN model_calls mc ON mc.trace_id = t.id
      LEFT JOIN agent_calls ac ON ac.trace_id = t.id
      WHERE ${whereClause}
      GROUP BY t.use_case_id
      ORDER BY traces DESC
    `;

    const byUseCaseResult = await query<{
      use_case_id: string;
      traces: string | number;
      model_calls: string | number;
      agent_calls: string | number;
      last_trace_at: Date | null;
    }>(byUseCaseQuery, params);

    const byUseCase: UseCaseStats[] = byUseCaseResult.rows.map((row) => ({
      useCaseId: row.use_case_id,
      traces: typeof row.traces === 'number' ? row.traces : parseInt(String(row.traces || '0'), 10),
      modelCalls: typeof row.model_calls === 'number' ? row.model_calls : parseInt(String(row.model_calls || '0'), 10),
      agentCalls: typeof row.agent_calls === 'number' ? row.agent_calls : parseInt(String(row.agent_calls || '0'), 10),
      lastTraceAt: row.last_trace_at ? (row.last_trace_at instanceof Date ? row.last_trace_at.toISOString() : new Date(row.last_trace_at).toISOString()) : undefined,
    }));

    const result: StatsOverview = {
      tenantId,
      environment: environment || undefined,
      from: defaultFrom.toISOString(),
      to: defaultTo.toISOString(),
      summary,
      byUseCase,
    };

    logger.debug('Overview stats fetched successfully', {
      tenantId,
      summary,
      useCaseCount: byUseCase.length,
    });

    return result;
  } catch (error) {
    logger.error('Failed to fetch overview stats', error, { tenantId, environment });
    throw error;
  }
}


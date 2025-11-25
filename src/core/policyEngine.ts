import { query } from '../infra/db';
import { logger } from '../infra/logger';
import { PolicyDecision, PolicyDecisionInput, PolicyRecord, PolicyMatch } from './types';

/**
 * Policy engine for making governance decisions
 * 
 * Simple matching engine that evaluates policies based on:
 * - Tenant ID
 * - Use case ID
 * - Intent name
 * - Environment
 * - Risk level
 * - Agent ID
 * - Model
 * - Data sensitivity
 */

/**
 * Check if a policy match criteria matches the input
 * @param match Policy match criteria
 * @param input Decision input
 * @returns True if all specified criteria match
 */
function matchesPolicy(match: PolicyMatch, input: PolicyDecisionInput): boolean {
  // Check each field in the match criteria
  if (match.use_case_id !== undefined && match.use_case_id !== input.useCaseId) {
    return false;
  }

  if (match.environment !== undefined && match.environment !== input.environment) {
    return false;
  }

  if (match.agent_id !== undefined && match.agent_id !== input.agentId) {
    return false;
  }

  if (match.intent_name !== undefined && match.intent_name !== input.intentName) {
    return false;
  }

  if (match.risk_level !== undefined && match.risk_level !== input.riskLevel) {
    return false;
  }

  if (match.data_sensitivity !== undefined && match.data_sensitivity !== input.dataSensitivity) {
    return false;
  }

  if (match.model !== undefined && match.model !== input.model) {
    return false;
  }

  return true;
}

/**
 * Make a policy decision based on input criteria
 * 
 * Rules:
 * 1. Fetch all policies for the tenant, ordered by priority (higher priority first)
 * 2. For each policy, check if the match criteria matches the input
 * 3. Return the first matching policy's decision
 * 4. If no policy matches, return { effect: "allow" }
 * 
 * @param input Decision input criteria
 * @returns Policy decision
 */
export async function decide(input: PolicyDecisionInput): Promise<PolicyDecision> {
  try {
    // Fetch all active policies for the tenant, ordered by priority (descending)
    const result = await query<PolicyRecord>(
      `SELECT id, tenant_id, name, priority, match, decision, created_at, updated_at
       FROM policies
       WHERE tenant_id = $1
       ORDER BY priority DESC`,
      [input.tenantId]
    );

    logger.debug('Evaluating policies', {
      tenantId: input.tenantId,
      policyCount: result.rows.length,
      input,
    });

    // Check each policy in priority order
    for (const policy of result.rows) {
      if (matchesPolicy(policy.match, input)) {
        logger.info('Policy matched', {
          policyId: policy.id,
          policyName: policy.name,
          priority: policy.priority,
          decision: policy.decision,
        });

        return {
          ...policy.decision,
          policyId: policy.id,
          policyName: policy.name,
        };
      }
    }

    // No policy matched - default to allow
    logger.debug('No policy matched, defaulting to allow', { input });
    return { effect: 'allow' };
  } catch (error) {
    logger.error('Failed to evaluate policies', error, { input });
    // On error, default to allow to avoid blocking operations
    return { effect: 'allow' };
  }
}


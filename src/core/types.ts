/**
 * Core type definitions for the governance node
 */

/**
 * Metadata for starting a trace
 */
export interface TraceMeta {
  intentName: string;
  useCaseId: string;
  riskLevel: string;
  dataSensitivity: string;
  environment: string;
  tenantId: string;
  extra?: Record<string, any>;
}

/**
 * Model call log entry
 */
export interface ModelCallLog {
  provider: string; // e.g., "openai", "anthropic"
  model: string;
  stepName: string;
  prompt: string; // may be truncated
  response: string; // may be truncated
  tokensInput?: number;
  tokensOutput?: number;
  latencyMs: number;
}

/**
 * Agent call log entry
 */
export interface AgentCallLog {
  agentId: string;
  domain: string;
  operation: string; // e.g., "apply-migration", "discovery-database"
  request: Record<string, any>;
  response: Record<string, any>;
  statusCode: number;
  latencyMs: number;
}

/**
 * Audit event log entry
 */
export interface AuditEventLog {
  eventType: string;
  payload: Record<string, any>;
}

/**
 * Policy match criteria
 */
export interface PolicyMatch {
  use_case_id?: string;
  environment?: string;
  agent_id?: string;
  intent_name?: string;
  risk_level?: string;
  data_sensitivity?: string;
  model?: string;
}

/**
 * Policy decision effect types
 */
export type PolicyEffect = 'allow' | 'deny' | 'require_approval' | 'override_model' | 'override_agent';

/**
 * Policy decision result
 */
export interface PolicyDecision {
  effect: PolicyEffect;
  overrideModel?: string; // if effect is "override_model"
  overrideAgent?: string; // if effect is "override_agent"
  reason?: string;
  policyId?: string;
  policyName?: string;
}

/**
 * Input for policy decision
 */
export interface PolicyDecisionInput {
  tenantId: string;
  useCaseId?: string;
  intentName?: string;
  environment?: string;
  riskLevel?: string;
  agentId?: string;
  model?: string;
  dataSensitivity?: string;
}

/**
 * Policy record from database
 */
export interface PolicyRecord {
  id: string;
  tenant_id: string;
  name: string;
  priority: number;
  match: PolicyMatch;
  decision: PolicyDecision;
  created_at: Date;
  updated_at: Date;
}

/**
 * Trace status
 */
export type TraceStatus = 'running' | 'success' | 'error' | 'cancelled';


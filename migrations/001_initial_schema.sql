-- NavriAIGP-Node Database Schema - Initial Migration
-- Migration: 001_initial_schema.sql
-- Description: Creates all required tables for the governance node

-- Tabela de migrations (deve ser criada primeiro)
CREATE TABLE IF NOT EXISTS migrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(name);

-- Tabela de traces
CREATE TABLE IF NOT EXISTS traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    intent_name TEXT NOT NULL,
    use_case_id TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    data_sensitivity TEXT NOT NULL,
    environment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'running',
    result_summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_traces_tenant_id ON traces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_traces_use_case_id ON traces(use_case_id);
CREATE INDEX IF NOT EXISTS idx_traces_created_at ON traces(created_at);

-- Tabela de model calls
CREATE TABLE IF NOT EXISTS model_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id UUID NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    step_name TEXT NOT NULL,
    prompt TEXT,
    response TEXT,
    tokens_input INTEGER,
    tokens_output INTEGER,
    latency_ms INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_calls_trace_id ON model_calls(trace_id);
CREATE INDEX IF NOT EXISTS idx_model_calls_provider ON model_calls(provider);

-- Tabela de agent calls
CREATE TABLE IF NOT EXISTS agent_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id UUID NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    operation TEXT NOT NULL,
    request JSONB NOT NULL,
    response JSONB NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_calls_trace_id ON agent_calls(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_calls_agent_id ON agent_calls(agent_id);

-- Tabela de audit events
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trace_id UUID NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_trace_id ON audit_events(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_event_type ON audit_events(event_type);

-- Tabela de policies
CREATE TABLE IF NOT EXISTS policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    priority INTEGER NOT NULL,
    match JSONB NOT NULL,
    decision JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_priority ON policies(tenant_id, priority DESC);


# NavriAIGP-Node

**Governance Node (Data Plane) for AIGP**

O NavriAIGP-Node é um serviço separado que atua como o data plane de governança para o AIGP (AI Governance Platform). Ele recebe eventos de governança vindos do Navri (traces, chamadas de LLM, chamadas de agentes, audit) e aplica políticas de decisão.

## Características

- ✅ Recebe e armazena eventos de governança (traces, model calls, agent calls, audit events)
- ✅ Armazena dados em PostgreSQL
- ✅ Motor de políticas simples para decisões de governança
- ✅ API RESTful com validação de payloads (Zod)
- ✅ Health check endpoint
- ✅ Logging estruturado

## Stack Tecnológica

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Banco de Dados**: PostgreSQL (via `pg`)
- **Validação**: Zod
- **Configuração**: dotenv

## Estrutura do Projeto

```
NavriAIGP-Node/
├── src/
│   ├── api/
│   │   ├── tracesRoutes.ts      # Rotas para traces
│   │   ├── policiesRoutes.ts    # Rotas para políticas
│   │   ├── healthRoutes.ts      # Health check
│   │   └── statsRoutes.ts       # Estatísticas e observabilidade
│   ├── core/
│   │   ├── traceService.ts      # Serviço de traces
│   │   ├── policyEngine.ts      # Motor de políticas
│   │   ├── statsService.ts      # Serviço de estatísticas
│   │   └── types.ts             # Definições de tipos
│   ├── infra/
│   │   ├── db.ts                # Conexão com PostgreSQL
│   │   └── logger.ts            # Logger estruturado
│   ├── scripts/
│   │   └── migrate.ts           # Script de migração do banco
│   └── server.ts                # Servidor principal
├── migrations/
│   └── 001_initial_schema.sql   # Migração inicial do schema
├── package.json
├── tsconfig.json
├── .env.example
├── schema.sql                   # Referência (legado)
└── README.md
```

## Configuração

### 1. Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env` e configure:

```bash
cp .env.example .env
```

Edite o `.env` com suas configurações:

```env
AIGP_NODE_PORT=4000
AIGP_DB_URL=postgres://user:password@localhost:5432/aigp
AIGP_TENANT_ID=tenant-local
LOG_LEVEL=info
```

### 2. Instalação de Dependências

```bash
npm install
```

### 3. Criação do Banco de Dados

Crie o banco de dados PostgreSQL:

```sql
CREATE DATABASE aigp;
```

### 4. Aplicar Migrações do Banco de Dados

O projeto usa um sistema de migrações para gerenciar o schema do banco de dados. Execute as migrações com:

```bash
npm run migrate
```

Este comando:
- Conecta ao banco usando `AIGP_DB_URL`
- Cria a tabela `migrations` (se não existir)
- Aplica todas as migrações em ordem (001, 002, 003...)
- Registra cada migração aplicada
- É **idempotente**: pode ser executado múltiplas vezes sem problemas

**Nota**: O arquivo `schema.sql` na raiz é mantido apenas como referência. Use o sistema de migrações para criar/atualizar o schema.

## Executando o Projeto

### Ambiente de Desenvolvimento (Lab Azure)

1. **Configurar variáveis de ambiente:**
```bash
cp .env.example .env
# Edite .env com suas configurações do Postgres na Azure
```

2. **Aplicar migrações:**
```bash
npm run migrate
```

3. **Iniciar servidor em desenvolvimento:**
```bash
npm run dev
```

O servidor será iniciado na porta configurada (padrão: 4000) com hot-reload.

### Build e Produção

```bash
# Compilar TypeScript
npm run build

# Aplicar migrações (se necessário)
npm run migrate

# Executar em produção
npm start
```

### Ambiente do Cliente (Data Plane na VPC)

O NavriAIGP-Node é entregue como container para o cliente. O processo de instalação no cliente segue estes passos:

1. **Cliente provisiona PostgreSQL** na VPC dele
2. **Cliente configura `AIGP_DB_URL`** apontando para o Postgres dele
3. **Cliente executa migrações:**
   ```bash
   npm run migrate
   # ou, se usando Docker:
   docker run --rm \
     -e AIGP_DB_URL=postgres://user:pass@host:5432/aigp \
     navri-aigp-node \
     npm run migrate
   ```
4. **Cliente inicia o serviço:**
   ```bash
   npm start
   # ou, se usando Docker:
   docker run -d \
     -e AIGP_DB_URL=postgres://user:pass@host:5432/aigp \
     -e AIGP_NODE_PORT=4000 \
     -e AIGP_TENANT_ID=tenant-cliente \
     -p 4000:4000 \
     navri-aigp-node
   ```

**Importante**: O sistema de migrações é idempotente e seguro. O cliente pode executar `npm run migrate` múltiplas vezes sem problemas. Migrações já aplicadas serão automaticamente puladas.

## Testando Rapidamente

Após configurar o ambiente e iniciar o servidor, você pode testar os endpoints básicos:

### 1. Health Check

Verifica se o serviço está rodando:

```bash
curl http://localhost:4000/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "uptime": 123,
  "timestamp": "2025-01-24T10:00:00.000Z"
}
```

### 2. Iniciar Trace

Cria um novo trace de governança:

```bash
curl -X POST http://localhost:4000/traces/start \
  -H "Content-Type: application/json" \
  -d '{
    "intentName": "CreateTableEmpresas",
    "useCaseId": "UC-DB-001",
    "riskLevel": "high",
    "dataSensitivity": "medium",
    "environment": "hml",
    "tenantId": "tenant-local",
    "extra": {}
  }'
```

**Resposta esperada:**
```json
{
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 3. Decisão de Política

Solicita uma decisão de política baseada nos critérios:

```bash
curl -X POST http://localhost:4000/policies/decide \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-local",
    "useCaseId": "UC-DB-001",
    "intentName": "CreateTableEmpresas",
    "environment": "hml",
    "riskLevel": "high",
    "agentId": "agent-dba",
    "model": "gpt-4.1-mini"
  }'
```

**Resposta padrão (sem policies configuradas):**
```json
{
  "effect": "allow"
}
```

**Resposta com policy aplicada:**
```json
{
  "effect": "require_approval",
  "policyId": "660e8400-e29b-41d4-a716-446655440000",
  "policyName": "Regra PRD - DBA exige aprovação"
}
```

## Endpoints da API

### Health Check

```bash
GET /health
```

Resposta:
```json
{
  "status": "ok",
  "uptime": 1234,
  "timestamp": "2025-01-24T10:00:00.000Z"
}
```

### Traces

#### Iniciar Trace

```bash
POST /traces/start
Content-Type: application/json

{
  "intentName": "CreateTableEmpresas",
  "useCaseId": "UC-DB-001",
  "riskLevel": "high",
  "dataSensitivity": "medium",
  "environment": "hml",
  "tenantId": "tenant-local",
  "extra": {}
}
```

Resposta:
```json
{
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Logar Model Call

```bash
POST /traces/model-call
Content-Type: application/json

{
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "provider": "openai",
  "model": "gpt-4",
  "stepName": "generate-sql",
  "prompt": "Create a table...",
  "response": "CREATE TABLE...",
  "tokensInput": 100,
  "tokensOutput": 50,
  "latencyMs": 1200
}
```

#### Logar Agent Call

```bash
POST /traces/agent-call
Content-Type: application/json

{
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "agentId": "agent-dba",
  "domain": "database",
  "operation": "apply-migration",
  "request": { "sql": "CREATE TABLE..." },
  "response": { "success": true },
  "statusCode": 200,
  "latencyMs": 500
}
```

#### Logar Audit Event

```bash
POST /traces/audit
Content-Type: application/json

{
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "policy_check",
  "payload": { "decision": "allow" }
}
```

#### Finalizar Trace

```bash
POST /traces/end
Content-Type: application/json

{
  "traceId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "resultSummary": { "tablesCreated": 1 }
}
```

### Policies

#### Decisão de Política

```bash
POST /policies/decide
Content-Type: application/json

{
  "tenantId": "tenant-local",
  "useCaseId": "UC-DB-001",
  "intentName": "CreateTableEmpresas",
  "environment": "hml",
  "riskLevel": "high",
  "agentId": "agent-dba",
  "model": "gpt-4.1-mini"
}
```

Resposta:
```json
{
  "effect": "require_approval",
  "policyId": "660e8400-e29b-41d4-a716-446655440000",
  "policyName": "Regra PRD - DBA exige aprovação"
}
```

Efeitos possíveis:
- `allow`: Permite a operação
- `deny`: Bloqueia a operação
- `require_approval`: Requer aprovação manual
- `override_model`: Substitui o modelo (inclui `overrideModel`)
- `override_agent`: Substitui o agente (inclui `overrideAgent`)

#### Importar Políticas

```bash
POST /policies/import
Content-Type: application/json

{
  "tenantId": "tenant-local",
  "version": "2025-11-24T10:00:00Z",
  "rules": [
    {
      "name": "Regra PRD - DBA exige aprovação",
      "priority": 10,
      "match": {
        "use_case_id": "UC-DB-001",
        "environment": "prd",
        "agent_id": "agent-dba"
      },
      "decision": {
        "effect": "require_approval"
      }
    }
  ]
}
```

### Statistics

#### Overview Statistics

```bash
GET /stats/overview?tenantId=tenant-local&environment=hml
```

**Query Parameters:**
- `tenantId` (required): Tenant/organization ID
- `environment` (optional): Filter by environment (dev/hml/prod)
- `from` (optional): Start date in ISO format (default: 7 days ago)
- `to` (optional): End date in ISO format (default: now)

**Resposta:**
```json
{
  "tenantId": "tenant-local",
  "environment": "hml",
  "from": "2025-01-18T00:00:00.000Z",
  "to": "2025-01-25T00:00:00.000Z",
  "summary": {
    "totalTraces": 123,
    "totalModelCalls": 456,
    "totalAgentCalls": 78
  },
  "byUseCase": [
    {
      "useCaseId": "UC-DB-001",
      "traces": 80,
      "modelCalls": 200,
      "agentCalls": 30,
      "lastTraceAt": "2025-01-24T12:00:00.000Z"
    },
    {
      "useCaseId": "UC-API-002",
      "traces": 43,
      "modelCalls": 256,
      "agentCalls": 48,
      "lastTraceAt": "2025-01-23T15:30:00.000Z"
    }
  ]
}
```

**Exemplos:**
```bash
# Últimos 7 dias (padrão)
curl "http://localhost:3000/stats/overview?tenantId=tenant-local"

# Filtrar por ambiente
curl "http://localhost:3000/stats/overview?tenantId=tenant-local&environment=hml"

# Período customizado
curl "http://localhost:3000/stats/overview?tenantId=tenant-local&from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z"

# Ambiente + período customizado
curl "http://localhost:3000/stats/overview?tenantId=tenant-local&environment=prod&from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z"
```

## Fluxo de Setup Completo

Para começar do zero, siga estes passos:

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com suas configurações (especialmente AIGP_DB_URL)

# 3. Criar banco de dados (se ainda não existir)
# Execute no PostgreSQL:
# CREATE DATABASE aigp;

# 4. Aplicar migrações
npm run migrate

# 5. Iniciar servidor em desenvolvimento
npm run dev
```

O servidor estará disponível em `http://localhost:4000` (ou a porta configurada em `AIGP_NODE_PORT`).

## Motor de Políticas

O motor de políticas funciona da seguinte forma:

1. **Busca**: Busca todas as políticas do `tenantId` ordenadas por `priority` (maior prioridade primeiro)
2. **Match**: Para cada política, verifica se os critérios de `match` correspondem aos campos do input
3. **Decisão**: Retorna a primeira política que faz match
4. **Default**: Se nenhuma política fizer match, retorna `{ effect: "allow" }`

### Critérios de Match

O match é feito por igualdade exata nos seguintes campos (quando especificados na política):
- `use_case_id`
- `environment`
- `agent_id`
- `intent_name`
- `risk_level`
- `data_sensitivity`
- `model`

## Logging

O sistema usa logging estruturado com níveis configuráveis:
- `debug`: Informações detalhadas
- `info`: Informações gerais
- `warn`: Avisos
- `error`: Erros

Configure o nível via `LOG_LEVEL` no `.env`.

## Desenvolvimento

### Scripts Disponíveis

- `npm run dev`: Executa em modo desenvolvimento com hot-reload
- `npm run build`: Compila TypeScript para `dist/`
- `npm start`: Executa a versão compilada
- `npm run migrate`: Aplica migrações do banco de dados
- `npm run type-check`: Verifica tipos sem compilar

### Estrutura de Código

- **api/**: Rotas HTTP com validação Zod
- **core/**: Lógica de negócio (serviços e motor de políticas)
- **infra/**: Infraestrutura (banco de dados, logger)
- **scripts/**: Scripts utilitários (migrações, etc.)
- **migrations/**: Arquivos SQL de migração do banco de dados

## Sistema de Migrações

O projeto usa um sistema simples de migrações baseado em arquivos SQL:

- **Localização**: `migrations/` (raiz do projeto)
- **Formato**: `NNN_description.sql` (ex: `001_initial_schema.sql`)
- **Ordem**: Migrações são aplicadas em ordem alfabética/numerica
- **Rastreamento**: Tabela `migrations` registra quais já foram aplicadas
- **Idempotência**: Executar `npm run migrate` múltiplas vezes é seguro

### Criando Novas Migrações

Para adicionar uma nova migração:

1. Crie um arquivo `migrations/002_add_new_feature.sql` (ou próximo número)
2. Escreva o SQL da migração
3. Execute `npm run migrate` para aplicar

**Exemplo de nova migração:**
```sql
-- Migration: 002_add_new_feature.sql
-- Description: Adiciona nova funcionalidade

ALTER TABLE traces ADD COLUMN IF NOT EXISTS new_field TEXT;
CREATE INDEX IF NOT EXISTS idx_traces_new_field ON traces(new_field);
```

## Licença

MIT


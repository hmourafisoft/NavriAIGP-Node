/**
 * Database Migration Script
 * 
 * This script applies SQL migrations from the migrations/ directory in order.
 * It tracks applied migrations in the migrations table to ensure idempotency.
 * 
 * Usage:
 *   npm run migrate
 *   or
 *   tsx src/scripts/migrate.ts
 */

import { Client } from 'pg';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import dotenv from 'dotenv';
import { logger } from '../infra/logger';

// Load environment variables
dotenv.config();

interface MigrationRecord {
  name: string;
  applied_at: Date;
}

/**
 * Get a database client for migrations
 * Uses a direct client instead of pool for better transaction control
 */
function getDbClient(): Client {
  const dbUrl = process.env.AIGP_DB_URL;
  
  if (!dbUrl) {
    throw new Error('AIGP_DB_URL environment variable is required');
  }

  return new Client({
    connectionString: dbUrl,
  });
}

/**
 * Ensure the migrations table exists
 * This is safe to run multiple times (idempotent)
 */
async function ensureMigrationsTable(client: Client): Promise<void> {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS migrations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    
    CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(name);
  `;

  await client.query(createTableQuery);
  logger.debug('Migrations table ensured');
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(client: Client): Promise<Set<string>> {
  const result = await client.query<MigrationRecord>(
    'SELECT name FROM migrations ORDER BY applied_at'
  );
  
  return new Set(result.rows.map(row => row.name));
}

/**
 * Get migration files from migrations/ directory, sorted by name
 */
async function getMigrationFiles(migrationsDir: string): Promise<string[]> {
  const files = await readdir(migrationsDir);
  
  // Filter only .sql files and sort by name (001, 002, 003...)
  const sqlFiles = files
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  return sqlFiles;
}

/**
 * Apply a single migration file
 */
async function applyMigration(
  client: Client,
  migrationName: string,
  migrationPath: string
): Promise<void> {
  logger.info(`Aplicando migration ${migrationName}...`);

  // Read the SQL file
  const sql = await readFile(migrationPath, 'utf-8');

  // Start transaction
  await client.query('BEGIN');

  try {
    // Execute the migration SQL
    await client.query(sql);

    // Record the migration
    await client.query(
      'INSERT INTO migrations (name, applied_at) VALUES ($1, NOW())',
      [migrationName]
    );

    // Commit transaction
    await client.query('COMMIT');

    logger.info(`Migration ${migrationName} aplicada com sucesso`);
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error(`Erro ao aplicar migration ${migrationName}`, error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function runMigrations(): Promise<void> {
  const client = getDbClient();
  const migrationsDir = join(process.cwd(), 'migrations');

  try {
    // Connect to database
    await client.connect();
    logger.info('Conectado ao banco de dados');

    // Ensure migrations table exists
    await ensureMigrationsTable(client);

    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations(client);
    logger.info(`Migrations já aplicadas: ${appliedMigrations.size}`);

    // Get migration files
    const migrationFiles = await getMigrationFiles(migrationsDir);
    
    if (migrationFiles.length === 0) {
      logger.warn('Nenhum arquivo de migration encontrado em migrations/');
      return;
    }

    logger.info(`Encontrados ${migrationFiles.length} arquivo(s) de migration`);

    // Apply migrations in order
    let appliedCount = 0;
    let skippedCount = 0;

    for (const migrationFile of migrationFiles) {
      const migrationPath = join(migrationsDir, migrationFile);

      if (appliedMigrations.has(migrationFile)) {
        logger.info(`Migration ${migrationFile} já aplicada, pulando.`);
        skippedCount++;
        continue;
      }

      await applyMigration(client, migrationFile, migrationPath);
      appliedCount++;
    }

    // Summary
    logger.info('Migrações concluídas', {
      aplicadas: appliedCount,
      puladas: skippedCount,
      total: migrationFiles.length,
    });

    if (appliedCount === 0 && skippedCount > 0) {
      logger.info('Todas as migrations já estão aplicadas. Nada a fazer.');
    }
  } catch (error) {
    logger.error('Erro fatal durante migração', error);
    process.exit(1);
  } finally {
    await client.end();
    logger.info('Conexão com banco de dados encerrada');
  }
}

// Run migrations if this script is executed directly
runMigrations()
  .then(() => {
    logger.info('Processo de migração finalizado com sucesso');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Processo de migração falhou', error);
    process.exit(1);
  });

export { runMigrations };


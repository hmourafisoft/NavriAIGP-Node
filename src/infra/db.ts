import { Pool, QueryResult } from 'pg';
import { logger } from './logger';

/**
 * Database connection pool and query utilities
 * Uses pg Pool for connection management
 */

let pool: Pool | null = null;

/**
 * Initialize the database connection pool
 */
export function initDb(): void {
  const dbUrl = process.env.AIGP_DB_URL;
  
  if (!dbUrl) {
    throw new Error('AIGP_DB_URL environment variable is required');
  }

  pool = new Pool({
    connectionString: dbUrl,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected error on idle database client', err);
  });

  logger.info('Database pool initialized', { dbUrl: dbUrl.replace(/:[^:@]+@/, ':****@') });
}

/**
 * Execute a database query
 * @param text SQL query text
 * @param params Query parameters
 * @returns Query result
 */
export async function query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initDb() first.');
  }

  const start = Date.now();
  
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Database query executed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    logger.error('Database query failed', error, {
      query: text.substring(0, 100),
      params: params?.map(p => typeof p === 'string' ? p.substring(0, 50) : p),
    });
    throw error;
  }
}

/**
 * Close the database connection pool
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
}


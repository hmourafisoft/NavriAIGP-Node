import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { initDb, closeDb } from './infra/db';
import { logger } from './infra/logger';
import healthRoutes from './api/healthRoutes';
import tracesRoutes from './api/tracesRoutes';
import policiesRoutes from './api/policiesRoutes';

// Load environment variables
dotenv.config();

const app = express();
// Support both PORT (Azure/containers) and AIGP_NODE_PORT (legacy)
const PORT = process.env.PORT || process.env.AIGP_NODE_PORT || 4000;
const TENANT_ID = process.env.AIGP_TENANT_ID || 'tenant-local';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware (simple configuration for now)
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.debug('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
  });
  next();
});

// Routes
app.use('/health', healthRoutes);
app.use('/traces', tracesRoutes);
app.use('/policies', policiesRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'NavriAIGP-Node',
    description: 'Governance node (data plane) for AIGP',
    version: '1.0.0',
    tenantId: TENANT_ID,
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', err, {
    method: req.method,
    path: req.path,
  });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database connection
    initDb();

    // Start HTTP server
    app.listen(PORT, () => {
      logger.info('NavriAIGP-Node started', {
        port: PORT,
        tenantId: TENANT_ID,
        environment: process.env.NODE_ENV || 'development',
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await closeDb();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await closeDb();
  process.exit(0);
});

// Start the server
startServer();


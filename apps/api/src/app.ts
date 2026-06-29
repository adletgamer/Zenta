import 'express-async-errors';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { readEnv } from './lib/stellar-env';

import { lotsRouter } from './routes/lots';
import { operatorsRouter } from './routes/operators';
import { ratesRouter } from './routes/rates';
import { payrollRouter } from './routes/payroll';
import { auditRouter } from './routes/audit';
import { zkRouter } from './routes/zk';
import { stellarRouter } from './routes/stellar';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const healthHandler: express.RequestHandler = (_req, res) => {
    res.json({
      status: 'ok',
      app: 'Zenta ERP API',
      version: '1.0.0',
      verificationMode: readEnv('VERIFICATION_MODE', 'SIMULATED'),
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  app.use('/api/lots', lotsRouter);
  app.use('/api/production', lotsRouter);
  app.use('/api/operators', operatorsRouter);
  app.use('/api/employees', operatorsRouter);
  app.use('/api/rates', ratesRouter);
  app.use('/api/payroll', payrollRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/zk', zkRouter);
  app.use('/api/stellar', stellarRouter);

  const errorHandler: express.ErrorRequestHandler = (err, _req, res, _next) => {
    console.error('[ERROR]', err.message, err.stack);
    res.statusCode = 500;
    res.json({
      success: false,
      error: err.message || 'Internal server error',
    });
  };

  const notFoundHandler: express.RequestHandler = (_req, res) => {
    res.statusCode = 404;
    res.json({ success: false, error: 'Route not found' });
  };

  app.use(errorHandler);
  app.use(notFoundHandler);

  return app;
}

export default createApp();

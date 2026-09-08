import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRouter from './routes/auth.routes.js';
import accountRouter from './routes/account.routes.js';
import transactionRoutes from './routes/transaction.routes.js';
import insightRouter from './routes/insight.routes.js';
import budgetRouter from './routes/budget.routes.js';
import notificationRouter from './routes/notification.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// Robust CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, idempotency-key, Idempotency-Key'
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Personal Banking & Transaction Management Platform',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/accounts', accountRouter);
app.use('/api/transactions', transactionRoutes);
app.use('/api/insights', insightRouter);
app.use('/api/budgets', budgetRouter);
app.use('/api/notifications', notificationRouter);

// Serve Frontend static build / files if available
const frontendDist = path.resolve(__dirname, '../../Frontend');
app.use(express.static(frontendDist));

// Fallback for SPA routing (compatible with Express 5)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
  }
  const indexPath = path.join(frontendDist, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send('Personal Banking Platform Backend running. Access /api for REST endpoints.');
    }
  });
});

export default app;
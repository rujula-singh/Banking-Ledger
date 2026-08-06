import express from 'express';
import authRouter from './routes/auth.routes.js';
import cookieParser from 'cookie-parser';
import accountRouter from './routes/account.routes.js';
import transactionRoutes from './routes/transaction.routes.js';

const app = express();
app.use(express.json()); 
app.use(cookieParser());

app.use("/",(req,res) => {
  res.send("Ledger Service is up and running")
})
app.use("/api/auth",authRouter);
app.use("/api/accounts",accountRouter);
app.use("/api/transactions",transactionRoutes);

export default app;
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import { getEmailProvider } from '../integrations/email/emailProviderFactory.js';
import { startEmailQueueWorker } from '../services/emailQueue.service.js';

dotenv.config();

await connectDB();
getEmailProvider();
const stopWorker = startEmailQueueWorker();

const shutdown = () => {
  stopWorker();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

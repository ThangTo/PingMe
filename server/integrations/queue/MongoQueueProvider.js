import QueueJob from '../../models/QueueJob.js';
import QueueProvider from './QueueProvider.js';

const DEFAULT_LOCK_DURATION_MS = 60_000;

class MongoQueueProvider extends QueueProvider {
  async enqueue({
    type,
    encryptedPayload,
    availableAt = new Date(),
    expiresAt,
    maxAttempts = 5,
  }) {
    return QueueJob.create({
      type,
      encryptedPayload,
      availableAt,
      expiresAt,
      maxAttempts,
    });
  }

  async claimNext({ type, workerId, lockDurationMs = DEFAULT_LOCK_DURATION_MS }) {
    const now = new Date();
    const staleLockAt = new Date(now.getTime() - lockDurationMs);

    return QueueJob.findOneAndUpdate(
      {
        type,
        expiresAt: { $gt: now },
        $expr: { $lt: ['$attempts', '$maxAttempts'] },
        $or: [
          { status: 'pending', availableAt: { $lte: now } },
          { status: 'processing', lockedAt: { $lte: staleLockAt } },
        ],
      },
      {
        $set: {
          status: 'processing',
          lockedAt: now,
          lockedBy: workerId,
        },
        $inc: { attempts: 1 },
      },
      { new: true, sort: { availableAt: 1, createdAt: 1 } },
    ).select('+encryptedPayload');
  }

  async complete(jobId, result = null) {
    return QueueJob.updateOne(
      { _id: jobId, status: 'processing' },
      {
        $set: {
          status: 'completed',
          result,
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: '',
          lastError: '',
        },
      },
    );
  }

  async retry(jobId, { error, availableAt }) {
    return QueueJob.updateOne(
      { _id: jobId, status: 'processing' },
      {
        $set: {
          status: 'pending',
          availableAt,
          lockedAt: null,
          lockedBy: '',
          lastError: error,
        },
      },
    );
  }

  async fail(jobId, error) {
    return QueueJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: 'failed',
          completedAt: new Date(),
          lockedAt: null,
          lockedBy: '',
          lastError: error,
        },
      },
    );
  }
}

export default MongoQueueProvider;

import { randomUUID } from 'crypto';
import { getQueueProvider } from '../integrations/queue/queueProviderFactory.js';
import OtpToken from '../models/OtpToken.js';
import { sendOtpEmail } from './email.service.js';
import { decryptQueuePayload, encryptQueuePayload } from './queuePayload.service.js';

export const OTP_EMAIL_JOB = 'otp_email';

const DEFAULT_POLL_INTERVAL_MS = 1000;
const DEFAULT_LOCK_DURATION_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 60_000;

const getNumberEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const getRetryDelayMs = (attempts) =>
  Math.min(1000 * 2 ** Math.max(attempts - 1, 0), MAX_BACKOFF_MS);

const getErrorMessage = (error) =>
  String(error?.message || error || 'Unknown queue error').slice(0, 1000);

export const enqueueOtpEmail = async ({ tokenId, email, code, purpose, expiresAt }) => {
  const provider = getQueueProvider();
  return provider.enqueue({
    type: OTP_EMAIL_JOB,
    encryptedPayload: encryptQueuePayload({ tokenId: tokenId.toString(), email, code, purpose }),
    expiresAt,
    maxAttempts: getNumberEnv('EMAIL_QUEUE_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS),
  });
};

const processOtpEmailJob = async (job, provider) => {
  const payload = decryptQueuePayload(job.encryptedPayload);
  const token = await OtpToken.findOne({
    _id: payload.tokenId,
    email: payload.email,
    purpose: payload.purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!token) {
    await provider.complete(job._id, { skipped: true, reason: 'otp_inactive_or_expired' });
    return;
  }

  const result = await sendOtpEmail(payload);
  token.emailDeliveryStatus = 'sent';
  token.emailSentAt = new Date();
  token.emailDeliveryError = '';
  await token.save();
  await provider.complete(job._id, {
    provider: result?.provider || '',
    messageId: result?.messageId || '',
  });
  console.log(`[EmailQueue] Job ${job._id} completed via ${result?.provider || 'unknown'}`);
};

export const processNextEmailJob = async ({ workerId = `email-worker-${randomUUID()}` } = {}) => {
  const provider = getQueueProvider();
  const job = await provider.claimNext({
    type: OTP_EMAIL_JOB,
    workerId,
    lockDurationMs: getNumberEnv('EMAIL_QUEUE_LOCK_MS', DEFAULT_LOCK_DURATION_MS),
  });

  if (!job) return false;

  try {
    await processOtpEmailJob(job, provider);
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const isTerminal = job.attempts >= job.maxAttempts || new Date(job.expiresAt) <= new Date();

    if (isTerminal) {
      await provider.fail(job._id, errorMessage);
      try {
        const payload = decryptQueuePayload(job.encryptedPayload);
        await OtpToken.updateOne(
          { _id: payload.tokenId },
          {
            $set: {
              emailDeliveryStatus: 'failed',
              emailDeliveryError: errorMessage,
            },
          },
        );
      } catch {
        // Job that bai van duoc luu lai de quan sat.
      }
    } else {
      await provider.retry(job._id, {
        error: errorMessage,
        availableAt: new Date(Date.now() + getRetryDelayMs(job.attempts)),
      });
    }

    console.warn(
      `[EmailQueue] Job ${job._id} failed attempt ${job.attempts}/${job.maxAttempts}: ${errorMessage}`,
    );
  }

  return true;
};

export const startEmailQueueWorker = () => {
  const workerId = `email-worker-${randomUUID()}`;
  const pollIntervalMs = getNumberEnv('EMAIL_QUEUE_POLL_MS', DEFAULT_POLL_INTERVAL_MS);
  let stopped = false;
  let timer = null;

  const schedule = (delay = pollIntervalMs) => {
    if (stopped) return;
    timer = setTimeout(run, delay);
    timer.unref?.();
  };

  const run = async () => {
    if (stopped) return;

    try {
      const processed = await processNextEmailJob({ workerId });
      schedule(processed ? 0 : pollIntervalMs);
    } catch (error) {
      console.error('[EmailQueue] Worker loop error:', getErrorMessage(error));
      schedule(pollIntervalMs);
    }
  };

  console.log(`[EmailQueue] Worker started: ${workerId}`);
  schedule(0);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    console.log(`[EmailQueue] Worker stopped: ${workerId}`);
  };
};

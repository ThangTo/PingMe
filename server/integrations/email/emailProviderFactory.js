import BrevoEmailProvider from './BrevoEmailProvider.js';
import ConsoleEmailProvider from './ConsoleEmailProvider.js';
import SmtpEmailProvider from './SmtpEmailProvider.js';

let providerInstance = null;
let providerDriver = null;

export const getEmailProvider = () => {
  const driver = (process.env.EMAIL_DRIVER || 'smtp').trim().toLowerCase();

  if (providerInstance && providerDriver === driver) return providerInstance;

  if (driver === 'smtp') {
    providerInstance = new SmtpEmailProvider();
    providerDriver = driver;
    return providerInstance;
  }

  if (driver === 'brevo') {
    providerInstance = new BrevoEmailProvider();
    providerDriver = driver;
    return providerInstance;
  }

  if (driver === 'console') {
    providerInstance = new ConsoleEmailProvider();
    providerDriver = driver;
    return providerInstance;
  }

  throw new Error(`Email driver không được hỗ trợ: ${driver}`);
};

export const resetEmailProviderForTests = () => {
  providerInstance = null;
  providerDriver = null;
};

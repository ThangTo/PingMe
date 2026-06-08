import nodemailer from 'nodemailer';
import EmailProvider from './EmailProvider.js';

const requiredEnv = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'];

const assertSmtpConfig = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`SMTP chua duoc cau hinh: thieu ${missing.join(', ')}`);
  }
};

class SmtpEmailProvider extends EmailProvider {
  constructor() {
    super('smtp');
    assertSmtpConfig();
    this.from = process.env.SMTP_FROM.trim();
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST.trim(),
      port: Number(process.env.SMTP_PORT),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER.trim(),
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendMail({ to, subject, text, html }) {
    return this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      text,
      html,
    });
  }
}

export default SmtpEmailProvider;

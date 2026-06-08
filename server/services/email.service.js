import { getEmailProvider } from '../integrations/email/emailProviderFactory.js';

const otpPurposeText = {
  register: 'xac thuc dang ky PingMe',
  password_reset: 'dat lai mat khau PingMe',
};

export const sendOtpEmail = async ({ email, code, purpose }) => {
  const title = otpPurposeText[purpose] || 'xac thuc PingMe';
  const subject = `Ma OTP PingMe cua ban: ${code}`;
  const text = [
    `Ma OTP de ${title}: ${code}`,
    'Ma nay co hieu luc trong 10 phut.',
    'Neu ban khong yeu cau thao tac nay, hay bo qua email nay.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f1d1a">
      <p>Ma OTP de ${title}:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
      <p>Ma nay co hieu luc trong 10 phut.</p>
      <p style="color:#6f6a62">Neu ban khong yeu cau thao tac nay, hay bo qua email nay.</p>
    </div>
  `;

  const provider = getEmailProvider();
  return provider.sendMail({
    to: email,
    subject,
    text,
    html,
  });
};

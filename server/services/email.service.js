import { getEmailProvider } from '../integrations/email/emailProviderFactory.js';

const otpPurposeText = {
  register: 'xác thực đăng ký PingMe',
  password_reset: 'đặt lại mật khẩu PingMe',
};

export const sendOtpEmail = async ({ email, code, purpose }) => {
  const title = otpPurposeText[purpose] || 'xac thuc PingMe';
  const subject = `Mã OTP PingMe của bạn: ${code}`;
  const text = [
    `Mã OTP để ${title}: ${code}`,
    'Mã này có hiệu lực trong 10 phút.',
    'Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f1d1a">
      <p>Mã OTP để ${title}:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p>
      <p>Mã này có hiệu lực trong 10 phút.</p>
      <p style="color:#6f6a62">Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email này.</p>
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

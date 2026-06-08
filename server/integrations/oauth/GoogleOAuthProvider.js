import { OAuth2Client } from 'google-auth-library';
import OAuthProvider from './OAuthProvider.js';

const requiredEnv = [
  'OAUTH_GOOGLE_CLIENT_ID',
  'OAUTH_GOOGLE_CLIENT_SECRET',
  'OAUTH_GOOGLE_CALLBACK_URL',
];

const assertGoogleConfig = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Google OAuth chua duoc cau hinh: thieu ${missing.join(', ')}`);
  }
};

class GoogleOAuthProvider extends OAuthProvider {
  constructor() {
    super('google');
    assertGoogleConfig();
    this.clientId = process.env.OAUTH_GOOGLE_CLIENT_ID.trim();
    this.client = new OAuth2Client(
      this.clientId,
      process.env.OAUTH_GOOGLE_CLIENT_SECRET.trim(),
      process.env.OAUTH_GOOGLE_CALLBACK_URL.trim(),
    );
  }

  getAuthorizationUrl({ state = '' } = {}) {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'select_account',
      scope: ['openid', 'email', 'profile'],
      state,
    });
  }

  async getProfileFromCode(code) {
    const { tokens } = await this.client.getToken(code);
    const idToken = tokens.id_token;
    if (!idToken) throw new Error('Google callback khong tra ve id_token');

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new Error('Google profile khong co email');

    return {
      provider: this.providerName,
      providerId: payload.sub,
      email: payload.email,
      emailVerified: Boolean(payload.email_verified),
      name: payload.name || payload.email.split('@')[0],
      avatar: payload.picture || '',
    };
  }
}

export default GoogleOAuthProvider;

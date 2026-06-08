import { randomBytes } from 'crypto';
import { getOAuthProvider } from '../integrations/oauth/oauthProviderFactory.js';

const GOOGLE_STATE_COOKIE = 'pingme_google_oauth_state';
const GOOGLE_STATE_MAX_AGE_MS = 10 * 60 * 1000;

export const createGoogleAuthorization = (res) => {
  const provider = getOAuthProvider('google');
  const state = randomBytes(24).toString('hex');

  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: GOOGLE_STATE_MAX_AGE_MS,
    path: '/api/auth/google',
  });

  return provider.getAuthorizationUrl({ state });
};

export const clearGoogleStateCookie = (res) => {
  res.clearCookie(GOOGLE_STATE_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth/google',
  });
};

export const validateGoogleState = (req) => {
  const cookieState = req.cookies?.[GOOGLE_STATE_COOKIE];
  const queryState = req.query?.state;
  return Boolean(cookieState && queryState && cookieState === queryState);
};

export const getGoogleProfileFromCallback = async (code) => {
  const provider = getOAuthProvider('google');
  return provider.getProfileFromCode(code);
};

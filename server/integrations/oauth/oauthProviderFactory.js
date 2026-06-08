import GoogleOAuthProvider from './GoogleOAuthProvider.js';

const providerInstances = new Map();

export const getOAuthProvider = (providerName) => {
  const provider = providerName.trim().toLowerCase();
  if (providerInstances.has(provider)) return providerInstances.get(provider);

  if (provider === 'google') {
    const instance = new GoogleOAuthProvider();
    providerInstances.set(provider, instance);
    return instance;
  }

  throw new Error(`OAuth provider khong duoc ho tro: ${provider}`);
};

export const resetOAuthProvidersForTests = () => {
  providerInstances.clear();
};

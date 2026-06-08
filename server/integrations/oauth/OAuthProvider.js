class OAuthProvider {
  constructor(providerName) {
    this.providerName = providerName;
  }

  getAuthorizationUrl() {
    throw new Error('OAuthProvider.getAuthorizationUrl must be implemented');
  }

  async getProfileFromCode() {
    throw new Error('OAuthProvider.getProfileFromCode must be implemented');
  }
}

export default OAuthProvider;

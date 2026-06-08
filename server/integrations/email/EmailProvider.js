class EmailProvider {
  constructor(providerName) {
    this.providerName = providerName;
  }

  async sendMail() {
    throw new Error('EmailProvider.sendMail must be implemented');
  }
}

export default EmailProvider;

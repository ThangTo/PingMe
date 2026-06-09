import EmailProvider from './EmailProvider.js';

class ConsoleEmailProvider extends EmailProvider {
  constructor() {
    super('console');
  }

  async sendMail({ to, subject, text }) {
    console.log('[Email:console]', { to, subject, text });
    return { messageId: `console-${Date.now()}`, provider: this.providerName };
  }
}

export default ConsoleEmailProvider;

class QueueProvider {
  async enqueue() {
    throw new Error('QueueProvider.enqueue must be implemented');
  }

  async claimNext() {
    throw new Error('QueueProvider.claimNext must be implemented');
  }

  async complete() {
    throw new Error('QueueProvider.complete must be implemented');
  }

  async retry() {
    throw new Error('QueueProvider.retry must be implemented');
  }

  async fail() {
    throw new Error('QueueProvider.fail must be implemented');
  }
}

export default QueueProvider;

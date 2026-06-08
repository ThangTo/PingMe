class RtcConfigProvider {
  getIceConfig() {
    throw new Error('RtcConfigProvider.getIceConfig must be implemented');
  }
}

export default RtcConfigProvider;

class UnsupportedWebSocket {
  constructor() {
    throw new Error("Node ws transport is not available in React Native");
  }
}

module.exports = UnsupportedWebSocket;
module.exports.default = UnsupportedWebSocket;

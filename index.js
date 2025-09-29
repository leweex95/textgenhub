// Export ChatGPT functionality
const ChatGPT = require('./src/textgenhub/chatgpt/chatgpt.js');

// Export any base provider or utility functions
const BaseProvider = require('./src/textgenhub/core/base-provider.js');
const BrowserManager = require('./src/textgenhub/core/browser-manager.js');

module.exports = {
    ChatGPT,
    BaseProvider,
    BrowserManager
};
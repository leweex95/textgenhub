// Export ChatGPT functionality
const ChatGPT = require('./src/textgenhub/chatgpt/chatgpt.js');

// Export DeepSeek functionality
const DeepSeek = require('./src/textgenhub/deepseek/deepseek.js');

// Export Perplexity functionality
const Perplexity = require('./src/textgenhub/perplexity/perplexity.js');

// Export any base provider or utility functions
const BaseProvider = require('./src/textgenhub/core/base-provider.js');
const BrowserManager = require('./src/textgenhub/core/browser-manager.js');

module.exports = {
    ChatGPT,
    DeepSeek,
    Perplexity,
    BaseProvider,
    BrowserManager
};
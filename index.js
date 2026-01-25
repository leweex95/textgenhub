// Export ChatGPT functionality (new session-based method - recommended)
const ChatGPT = require('./src/textgenhub/chatgpt/chatgpt.js');

// Export DeepSeek functionality
const DeepSeek = require('./src/textgenhub/deepseek/deepseek.js');

// Export Perplexity functionality
const Perplexity = require('./src/textgenhub/perplexity/perplexity.js');

// Export Grok functionality
const Grok = require('./src/textgenhub/grok/grok.js');

// Export any base provider or utility functions
const BaseProvider = require('./src/textgenhub/core/base-provider.js');
const BrowserManager = require('./src/textgenhub/core/browser-manager.js');

module.exports = {
    ChatGPT,        // New session-based method (recommended)
    DeepSeek,
    Perplexity,
    Grok,
    BaseProvider,
    BrowserManager
};

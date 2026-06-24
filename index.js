// Export ChatGPT functionality (new session-based method - recommended)
const ChatGPT = require('./src/textgenhub/webui/chatgpt/chatgpt.js');

// Export DeepSeek functionality
const DeepSeek = require('./src/textgenhub/webui/deepseek/deepseek.js');

// Export Perplexity functionality
const Perplexity = require('./src/textgenhub/webui/perplexity/perplexity.js');

// Export Grok functionality
const Grok = require('./src/textgenhub/webui/grok/grok.js');

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

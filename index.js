// Export ChatGPT functionality (new attach-based method - recommended)
const ChatGPT = require('./src/textgenhub/chatgpt/chatgpt.js');

// Export legacy ChatGPT functionality (old puppeteer-based method)
const ChatGPTLegacy = require('./src/textgenhub/chatgpt_old/chatgpt.cjs');

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
    ChatGPT,        // New attach-based method (recommended)
    ChatGPTLegacy,  // Old puppeteer-based method (fallback)
    DeepSeek,
    Perplexity,
    Grok,
    BaseProvider,
    BrowserManager
};

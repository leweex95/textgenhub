const assert = require('assert');
const ChatGPTProvider = require('../../src/textgenhub/chatgpt/chatgpt');

describe('ChatGPT Provider Tests', () => {
    let provider;

    before(async () => {
        provider = new ChatGPTProvider({
            headless: false, // Use non-headless to avoid detection
            removeCache: true,
            timeout: 60000,
            debug: true
        });
    });

    after(async () => {
        if (provider) {
            try {
                await provider.cleanup();
                console.log('ChatGPT provider cleanup completed');
            } catch (error) {
                console.error('Error during ChatGPT cleanup:', error);
            }
        }
    });

    it('should initialize successfully', async () => {
        await provider.initialize();
        assert.strictEqual(provider.isInitialized, true, 'Provider should be initialized');
    }).timeout(60000);

    it('should generate a response to a simple prompt', async () => {
        const prompt = 'What is 2+2?';
        const response = await provider.generateContent(prompt);
        assert.ok(response.length > 0, 'Response should not be empty');
        assert.ok(response.includes('4'), 'Response should contain the answer');
    }).timeout(60000);

    it('should handle a complex prompt', async () => {
        const prompt = 'Explain quantum entanglement in simple terms.';
        const response = await provider.generateContent(prompt);
        assert.ok(response.length > 20, 'Response should be reasonably detailed');
    }).timeout(120000);
});

const assert = require('assert');
const DeepSeekProvider = require('../../src/textgenhub/deepseek/deepseek');

describe('DeepSeek Provider Tests', () => {
    let provider;

    before(async () => {
        provider = new DeepSeekProvider({
            headless: false, // Set to false for visual debugging
            removeCache: true,
            timeout: 60000
        });
    });

    after(async () => {
        if (provider) {
            try {
                await provider.cleanup();
                console.log('DeepSeek provider cleanup completed');
            } catch (error) {
                console.error('Error during DeepSeek cleanup:', error);
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

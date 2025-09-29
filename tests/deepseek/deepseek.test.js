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
            await provider.cleanup();
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
        const prompt = 'Explain the concept of quantum entanglement in simple terms.';
        const response = await provider.generateContent(prompt);
        assert.ok(response.length > 100, 'Response should be detailed');
    }).timeout(60000);

    it('should handle special characters', async () => {
        const prompt = 'What does this mean: 🌟✨🚀?';
        const response = await provider.generateContent(prompt);
        assert.ok(response.length > 0, 'Response should handle special characters');
    }).timeout(60000);

    it('should handle multiple consecutive requests', async () => {
        const prompts = [
            'Tell me a joke',
            'What is the capital of France?',
            'Who wrote Romeo and Juliet?'
        ];

        for (const prompt of prompts) {
            const response = await provider.generateContent(prompt);
            assert.ok(response.length > 0, `Response for "${prompt}" should not be empty`);
        }
    }).timeout(180000);

    it('should handle network interruption simulation', async () => {
        // This test needs to be run with headless: false to manipulate browser
        try {
            const prompt = 'What is the meaning of life?';
            const responsePromise = provider.generateContent(prompt);
            
            // Simulate network interruption by trying to navigate away
            await provider.browserManager.page.goto('about:blank');
            
            await responsePromise;
            assert.fail('Should have thrown an error');
        } catch (error) {
            assert.ok(error.message.includes('network') || error.message.includes('navigation'), 
                'Should handle network interruption gracefully');
        }
    }).timeout(60000);
});
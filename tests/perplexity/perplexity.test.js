const assert = require('assert');
const PerplexityProvider = require('../../src/textgenhub/perplexity/perplexity');

describe('Perplexity Provider Test', () => {
    let provider;

    before(async () => {
        provider = new PerplexityProvider({
            headless: false,
            removeCache: true,
            timeout: 60000
        });
    });

    after(async function() {
        this.timeout(30000);
        if (provider) {
            await provider.cleanup();
        }
    });

    it('should initialize and answer a simple math question', async () => {
        // First initialize
        await provider.initialize();
        assert.strictEqual(provider.isInitialized, true, 'Provider should be initialized');

        // Then test with a simple math question
        const prompt = 'What is 2+2?';
        const response = await provider.generateContent(prompt);
        console.log('Response received:', response); // Debug log
        assert.ok(response.length > 0, 'Response should not be empty');
        assert.ok(
            response.toLowerCase().includes('4') || 
            response.toLowerCase().includes('answer is 4') ||
            response.toLowerCase().includes('equals 4') || 
            response.toLowerCase().includes('sum is 4'),
            'Response should contain the number 4'
        );
    }).timeout(90000);
});

describe('Perplexity Provider Headless Tests', () => {
    let headlessProvider;

    before(async () => {
        headlessProvider = new PerplexityProvider({
            headless: true, // Test headless mode
            removeCache: true,
            timeout: 120000, // Increased timeout for headless
            userDataDir: require('path').join(process.cwd(), 'temp', 'perplexity-headless-session')
        });
    });

    after(async function() {
        this.timeout(30000); // Increased cleanup timeout
        if (headlessProvider) {
            await headlessProvider.cleanup();
        }
    });

    it('should work in headless mode', async () => {
        await headlessProvider.initialize();
        assert.strictEqual(headlessProvider.isInitialized, true, 'Provider should be initialized in headless mode');
        
        // Using an extremely simple prompt for headless mode
        const prompt = '1+1=?';
        const response = await headlessProvider.generateContent(prompt);
        assert.ok(response && response.length > 0, 'Response should not be empty in headless mode');
        assert.ok(
            response.toLowerCase().includes('2') || 
            response.toLowerCase().includes('sum') || 
            response.toLowerCase().includes('equals'),
            'Response should contain a recognizable answer'
        );
    }).timeout(120000);
});
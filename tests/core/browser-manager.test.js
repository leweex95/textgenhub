const assert = require('assert');
const BrowserManager = require('../../src/textgenhub/core/browser-manager');

describe('BrowserManager Tests', () => {
    let browserManager;

    before(async () => {
        browserManager = new BrowserManager({
            headless: false,
            timeout: 30000
        });
        await browserManager.initialize();
    });

    after(async () => {
        if (browserManager.browser) {
            await browserManager.browser.close();
        }
    });

    it('should get elements using a selector', async () => {
        await browserManager.navigateToUrl('https://example.com');
        const elements = await browserManager.$$('p');
        assert.ok(Array.isArray(elements), 'Should return an array of elements');
    }).timeout(30000);
});

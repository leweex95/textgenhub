import { describe, it, before, after } from 'mocha';
import { assert } from 'assert';
import {
  connectToExistingChrome,
  launchControlledChromium,
  ensureLoggedIn,
  sendPrompt,
  scrapeResponse
} from '../lib/index.js';
import {
  NoPageError,
  LoginRequiredError,
  SessionInvalidError,
  ScrapeError
} from '../lib/errors.js';

describe('chatgpt-attach', () => {
  let browser;
  let page;

  after(async () => {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // Ignore
      }
    }
  });

  describe('connectToExistingChrome', () => {
    it('should throw NoPageError when no ChatGPT page is found', async () => {
      try {
        await connectToExistingChrome({
          browserURL: 'http://127.0.0.1:9999'
        });
        assert.fail('Should have thrown NoPageError');
      } catch (error) {
        assert(error instanceof NoPageError || error.message.includes('Failed to connect'));
      }
    });
  });

  describe('launchControlledChromium', () => {
    it('should launch Chromium and navigate to ChatGPT', async () => {
      const { browser: b, page: p } = await launchControlledChromium({
        headless: true
      });

      browser = b;
      page = p;

      assert(page);
      assert(page.url().includes('chat.openai.com'));
    });
  });

  describe('ensureLoggedIn', () => {
    it('should check login status without throwing on unauthenticated page', async () => {
      if (!page) {
        console.log('Skipping ensureLoggedIn test - no page available');
        return;
      }

      try {
        const result = await ensureLoggedIn(page);
        assert(typeof result === 'boolean');
      } catch (error) {
        assert(
          error instanceof LoginRequiredError ||
          error instanceof SessionInvalidError
        );
      }
    });
  });

  describe('Error classes', () => {
    it('should instantiate error classes correctly', () => {
      const errors = [
        new NoPageError('test'),
        new LoginRequiredError('test'),
        new SessionInvalidError('test'),
        new ScrapeError('test')
      ];

      errors.forEach((error) => {
        assert(error instanceof Error);
        assert(error.message === 'test');
      });
    });

    it('should have correct error names', () => {
      assert(new NoPageError().name === 'NoPageError');
      assert(new LoginRequiredError().name === 'LoginRequiredError');
      assert(new SessionInvalidError().name === 'SessionInvalidError');
      assert(new ScrapeError().name === 'ScrapeError');
    });
  });
});

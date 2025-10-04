/**
 * Browser Manager - Handles browser automation for LLM interactions
 * Uses Puppeteer with stealth mode to avoid detection
 */

'use strict';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
function createMinimalLogger(debugEnabled) {
  return {
    info: (...args) => {
      // Only show crucial info logs
      if (
        args[0]?.includes?.('Browser manager initialized') ||
        args[0]?.includes?.('Browser initialized successfully') ||
        args[0]?.includes?.('Navigating to URL') ||
        args[0]?.includes?.('Navigation successful')
      ) {
        console.info('[textgenhub]', ...args);
      }
    },
    error: (...args) => {
      // Always show errors
      console.error('[textgenhub]', ...args);
    },
    warn: (...args) => {
      // Only show warnings if debug is enabled
      if (debugEnabled) console.warn('[textgenhub]', ...args);
    },
    debug: (...args) => {
      // Only show debug logs if debug is enabled
      if (debugEnabled) console.debug('[textgenhub]', ...args);
    },
  };
}

// Configure stealth plugin
puppeteer.use(StealthPlugin());

class BrowserManager {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.isInitialized = false;

    // Default browser configuration
    this.config = {
      headless: options.headless !== false, // Default to headless
      timeout: options.timeout || 30000,
      retries: options.retries || 3,
      userDataDir: options.userDataDir || null,
      proxy: options.proxy || null,
      viewport: options.viewport || { width: 1920, height: 1080 },
      connectToExisting: options.connectToExisting || false,
      minimizeWindow: options.minimizeWindow || false,
      ...options,
    };

    this.logger = createMinimalLogger(!!this.config.debug);
    this.logger.info('Browser manager initialized', {
      headless: this.config.headless,
      timeout: this.config.timeout,
    });
  }

  /**
   * Initialize the browser instance
   */
  async initialize() {
    if (this.isInitialized) {
      this.logger.debug('Browser already initialized');
      return;
    }

    // Configure additional browser arguments for better stability
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ];
    
    // In headless mode, add special configuration
    if (this.config.headless) {
      // Use new headless mode and add necessary flags
      this.config.headless = 'new';
      browserArgs.push(
        '--disable-web-security',
        '--disable-features=IsolateOrigins',
        '--disable-site-isolation-trials',
        '--window-size=1920,1080',
        '--allow-running-insecure-content',
        '--mute-audio'
      );
    }

    // Check if Chrome is available
    try {
      const { execSync } = require('child_process');
      const fs = require('fs');
      const path = require('path');
      
      let chromeFound = false;
      
      if (process.platform === 'win32') {
        // Check multiple common Chrome installation paths on Windows
        const chromePaths = [
          'chrome', // PATH
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
          process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
          process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe'
        ];
        
        for (const chromePath of chromePaths) {
          try {
            if (chromePath === 'chrome') {
              execSync('where chrome', { stdio: 'ignore' });
            } else if (fs.existsSync(chromePath)) {
              // Path exists
            } else {
              continue;
            }
            chromeFound = true;
            this.logger.info('Chrome found at:', chromePath);
            break;
          } catch (error) {
            // Continue to next path
          }
        }
      } else {
        // Unix-like systems
        try {
          execSync('which google-chrome', { stdio: 'ignore' });
          chromeFound = true;
          this.logger.info('Chrome found in PATH');
        } catch (error) {
          // Chrome not in PATH
        }
      }
      
      if (!chromeFound) {
  this.logger.warn('Chrome not found in common locations, Puppeteer will use bundled Chromium');
      }
    } catch (error) {
  this.logger.warn('Error checking for Chrome:', error.message);
    }

    try {
      // Try to connect to existing browser instance first if requested
      if (this.config.connectToExisting) {
        try {
          this.logger.info('Attempting to connect to existing browser instance...');
          this.browser = await puppeteer.connect({
            browserURL: 'http://localhost:9222', // Default Chrome debugging port
          });
          this.page = await this.browser.newPage();
          this.logger.info('Connected to existing browser instance');
        } catch (error) {
          this.logger.warn(
            'Could not connect to existing browser, launching new one',
            {
              error: error.message,
            }
          );
          // Fall through to launch new browser
        }
      }

      // Launch new browser if not connected to existing one
      if (!this.browser) {
  this.logger.info('Launching browser...');

        const launchOptions = {
          headless: this.config.headless ? 'new' : false,
          defaultViewport: this.config.viewport,
          args: browserArgs,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            // '--disable-gpu',
            // '--disable-web-security',
            // '--disable-features=VizDisplayCompositor',
            // '--no-first-run',
            // '--disable-extensions',
            // '--disable-plugins',
            // '--disable-background-timer-throttling',
            // '--disable-backgrounding-occluded-windows',
            // '--disable-renderer-backgrounding',
            // '--disable-field-trial-config',
            // '--disable-ipc-flooding-protection',
            // '--disable-hang-monitor',
            // '--disable-prompt-on-repost',
            // '--disable-client-side-phishing-detection',
            // '--disable-component-update',
            // '--disable-default-apps',
            // '--disable-sync',
            // '--disable-translate',
            // '--hide-scrollbars',
            // '--mute-audio',
            // '--no-default-browser-check',
            // '--no-experiments',
            // '--no-pings',
            // '--disable-background-networking',
            // '--disable-breakpad',
            // '--disable-component-extensions-with-background-pages',
            // '--enable-features=NetworkService,NetworkServiceLogging',
            // '--force-color-profile=srgb',
            // '--metrics-recording-only',
            // '--use-mock-keychain',
          ],
          ignoreDefaultArgs: ['--enable-automation'],
        };

        // Add proxy if configured
        if (this.config.proxy) {
          launchOptions.args.push(`--proxy-server=${this.config.proxy}`);
          this.logger.info('Using proxy', { proxy: this.config.proxy });
        }

        // Add user data directory if configured
        if (this.config.userDataDir) {
          launchOptions.userDataDir = this.config.userDataDir;
          this.logger.info('Using user data directory', {
            dir: this.config.userDataDir,
          });
        } else {
          this.logger.info(
            'Using default browser profile (no custom user data directory)'
          );
        }

        try {
          this.browser = await puppeteer.launch(launchOptions);
          this.page = await this.browser.newPage();
        } catch (error) {
          this.logger.debug(
            'Full browser options failed, using minimal options',
            { error: error.message }
          );

          // Fallback to minimal launch options
          const minimalOptions = {
            headless: this.config.headless,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              // '--disable-gpu',
              // '--disable-web-security',
              // '--disable-features=VizDisplayCompositor',
            ],
            ignoreDefaultArgs: ['--enable-automation'],
          };

          try {
            this.browser = await puppeteer.launch(minimalOptions);
            this.page = await this.browser.newPage();
          } catch (minimalError) {
            this.logger.error('Failed to launch browser with minimal options', { error: minimalError.message });
            throw new Error(`Browser launch failed: ${minimalError.message}`);
          }
        }
      }

      // Set user agent to appear more human-like
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Set default timeouts
      this.page.setDefaultTimeout(this.config.timeout);
      this.page.setDefaultNavigationTimeout(this.config.timeout);

      // Minimize browser window if requested (only in non-headless mode)
      if (this.config.minimizeWindow && !this.config.headless) {
        await this.minimizeBrowserWindow();
      }

      this.isInitialized = true;
  this.logger.info('Browser initialized successfully');
    } catch (error) {
  this.logger.error('Failed to initialize browser', { error: error.message });
      throw new Error(`Browser initialization failed: ${error.message}`);
    }
  }

  /**
   * Navigate to a URL with retry logic
   * @param {string} url - Target URL
   * @param {Object} options - Navigation options
   */
  async navigateToUrl(url, options = {}) {
    await this.ensureInitialized();

    const navOptions = {
      waitUntil: 'networkidle2',
      timeout: this.config.timeout,
      ...options,
    };

    for (let attempt = 1; attempt <= this.config.retries; attempt++) {
      try {
  this.logger.info('Navigating to URL', { url, attempt });

        await this.page.goto(url, navOptions);

        // Wait for page to be fully loaded
        await this.page.waitForFunction(
          () => document.readyState === 'complete'
        );

  this.logger.info('Navigation successful', { url });
        return;
      } catch (error) {
  this.logger.warn(`Navigation attempt ${attempt} failed`, {
          url,
          error: error.message,
        });

        if (attempt === this.config.retries) {
          throw new Error(
            `Failed to navigate to ${url} after ${this.config.retries} attempts: ${error.message}`
          );
        }

        // Wait before retrying
        await this.delay(2000 * attempt);
      }
    }
  }

  /**
   * Wait for an element to be available
   * @param {string} selector - CSS selector
   * @param {Object} options - Wait options
   */
  async waitForElement(selector, options = {}) {
    await this.ensureInitialized();

    const waitOptions = {
      timeout: this.config.timeout,
      visible: true,
      ...options,
    };

    try {
      this.logger.debug('Waiting for element', { selector });

      await this.page.waitForSelector(selector, waitOptions);

      this.logger.debug('Element found', { selector });
      return await this.page.$(selector);
    } catch (error) {
      this.logger.error('Element not found', { selector, error: error.message });
      throw new Error(`Element not found: ${selector}`);
    }
  }

  /**
   * Type text into an element
   * @param {string} selector - CSS selector
   * @param {string} text - Text to type
   * @param {Object} options - Typing options
   */
  async typeText(selector, text, options = {}) {
    await this.ensureInitialized();

    const element = await this.waitForElement(selector);

    try {
      this.logger.debug('Typing text', { selector, textLength: text.length });

      // Clear existing text
      await element.click({ clickCount: 3 });
      await element.press('Backspace');

      // Type new text with human-like delay
      await element.type(text, { delay: options.delay || 50 });

      this.logger.debug('Text typed successfully', { selector });
    } catch (error) {
      this.logger.error('Failed to type text', { selector, error: error.message });
      throw new Error(`Failed to type text in ${selector}: ${error.message}`);
    }
  }

  /**
   * Type multi-line text safely for chat interfaces (uses Shift+Enter for newlines)
   * @param {string} selector - CSS selector for text input
   * @param {string} text - Multi-line text to type
   * @param {Object} options - Typing options
   */
  async typeMultiLineText(selector, text, options = {}) {
    await this.ensureInitialized();

    const element = await this.waitForElement(selector);

    try {
  this.logger.debug('Typing multi-line text safely', {
        selector,
        textLength: text.length,
        lineCount: text.split('\n').length,
      });

      // Clear existing text
      await element.click({ clickCount: 3 });
      await element.press('Backspace');

      // Split text by newlines and type each part separately
      const lines = text.split('\n');
      const delay = options.delay || 50;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Type the line content
        if (line.length > 0) {
          await element.type(line, { delay });
        }

        // Add newline with Shift+Enter (except for the last line)
        if (i < lines.length - 1) {
          await this.page.keyboard.down('Shift');
          await this.page.keyboard.press('Enter');
          await this.page.keyboard.up('Shift');

          // Small delay between lines for natural typing
          await this.delay(delay * 2);
        }
      }

  this.logger.debug('Multi-line text typed successfully', {
        selector,
        linesTyped: lines.length,
      });
    } catch (error) {
  this.logger.error('Failed to type multi-line text', {
        selector,
        error: error.message,
      });
      throw new Error(
        `Failed to type multi-line text in ${selector}: ${error.message}`
      );
    }
  }

  /**
   * Alternative method: Set text value directly via JavaScript (most robust)
   * @param {string} selector - CSS selector for text input
   * @param {string} text - Text content to set
   */
  async setTextValue(selector, text) {
    await this.ensureInitialized();

    try {
  this.logger.debug('Setting text value directly', {
        selector,
        textLength: text.length,
      });

      await this.page.$eval(
        selector,
        (element, newText) => {
          // Focus the element first
          element.focus();

          // Handle different types of text input elements
          if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            // Standard form elements
            element.value = newText;

            // Trigger input events
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            // For React applications
            if ('_valueTracker' in element) {
              element._valueTracker.setValue('');
            }

            // Set cursor to the end
            element.setSelectionRange(newText.length, newText.length);
          } else if (
            element.contentEditable === 'true' ||
            element.hasAttribute('contenteditable')
          ) {
            // Contenteditable div elements (like Claude)
            element.textContent = newText;

            // Trigger input events for contenteditable
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            // Set cursor to the end for contenteditable
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(element);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            // Fallback: try setting innerHTML or textContent
            if (element.innerHTML !== undefined) {
              element.innerHTML = newText.replace(/\n/g, '<br>');
            } else {
              element.textContent = newText;
            }

            // Trigger events
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        },
        text
      );

      // Give the UI time to update
      await this.delay(100);

  this.logger.debug('Text value set successfully', { selector });
    } catch (error) {
  this.logger.error('Failed to set text value', {
        selector,
        error: error.message,
      });
      throw new Error(
        `Failed to set text value in ${selector}: ${error.message}`
      );
    }
  }

  /**
   * Click an element
   * @param {string} selector - CSS selector
   * @param {Object} options - Click options
   */
  async clickElement(selector, options = {}) {
    await this.ensureInitialized();

    const element = await this.waitForElement(selector);

    try {
  this.logger.debug('Clicking element', { selector });

      await element.click(options);

  this.logger.debug('Element clicked successfully', { selector });
    } catch (error) {
  this.logger.error('Failed to click element', {
        selector,
        error: error.message,
      });
      throw new Error(`Failed to click ${selector}: ${error.message}`);
    }
  }

  // /**
  //  * Extract text from an element
  //  * @param {string} selector - CSS selector
  //  * @param {Object} options - Extraction options
  //  */
  // async extractText(selector, options = {}) {
  //   await this.ensureInitialized();

  //   try {
  //     logger.debug('Extracting text', { selector });

  //     const text = await this.page.$eval(
  //       selector,
  //       (el, opts) => {
  //         if (opts.attribute) {
  //           return el.getAttribute(opts.attribute);
  //         }
  //         return el.textContent || el.innerText;
  //       },
  //       options
  //     );

  //     logger.debug('Text extracted successfully', {
  //       selector,
  //       textLength: text?.length,
  //     });
  //     return text;
  //   } catch (error) {
  //     logger.error('Failed to extract text', {
  //       selector,
  //       error: error.message,
  //     });
  //     throw new Error(
  //       `Failed to extract text from ${selector}: ${error.message}`
  //     );
  //   }
  // }

  // /**
  //  * Execute custom JavaScript in the page context
  //  * @param {Function} fn - Function to execute
  //  * @param {...any} args - Arguments to pass to the function
  //  */
  // async evaluateInPage(fn, ...args) {
  //   await this.ensureInitialized();

  //   try {
  //     const result = await this.page.evaluate(fn, ...args);
  //     logger.debug('Page evaluation successful');
  //     return result;
  //   } catch (error) {
  //     logger.error('Page evaluation failed', { error: error.message });
  //     throw new Error(`Page evaluation failed: ${error.message}`);
  //   }
  // }

  /**
   * Wait for a specified amount of time
   * @param {number} ms - Milliseconds to wait
   */
  async delay(ms) {
  this.logger.debug('Waiting', { ms });
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Ensure browser is initialized
   */
  async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Minimize browser window to taskbar (Windows/non-headless only)
   */
  async minimizeBrowserWindow() {
    try {
      if (this.config.headless) {
  this.logger.debug('Cannot minimize window in headless mode');
        return;
      }

  this.logger.debug('Attempting to minimize browser window...');

      // Get all browser pages/windows
      const pages = await this.browser.pages();

      for (const page of pages) {
        try {
          // Use Chrome DevTools Protocol to minimize window
          const session = await page.target().createCDPSession();

          // Get window bounds first
          const { windowId } = await session.send('Browser.getWindowForTarget');

          // Minimize the window
          await session.send('Browser.setWindowBounds', {
            windowId: windowId,
            bounds: { windowState: 'minimized' },
          });

          await session.detach();
          this.logger.info('Browser window minimized successfully');
          break; // Only minimize the first window
        } catch (error) {
          this.logger.debug(
            'Failed to minimize window via CDP, trying alternative',
            {
              error: error.message,
            }
          );

          // Fallback: try to minimize via page evaluation
          try {
            await page.evaluate(() => {
              if (
                window.chrome &&
                window.chrome.app &&
                window.chrome.app.window
              ) {
                window.chrome.app.window.current().minimize();
              }
            });
            this.logger.info('Browser window minimized via fallback method');
            break;
          } catch (fallbackError) {
            this.logger.warn('Could not minimize browser window', {
              error: fallbackError.message,
            });
          }
        }
      }
    } catch (error) {
  this.logger.error('Failed to minimize browser window', {
        error: error.message,
      });
      // Don't throw - minimization failure shouldn't stop the application
    }
  }

  /**
   * Clean up Puppeteer cache folders inside userDataDir with retry
   */
  async cleanupCache() {
    if (!this.config.userDataDir) return;

    const fs = require('fs');
    const path = require('path');

    const cacheFolders = ['Code Cache', 'Cache', 'DawnGraphiteCache'];

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    for (const folder of cacheFolders) {
      const folderPath = path.join(this.config.userDataDir, 'Default', folder);
      if (!fs.existsSync(folderPath)) continue;

      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        try {
          fs.rmSync(folderPath, { recursive: true, force: true });
          console.info(`Deleted cache folder: ${folderPath}`);
          break;
        } catch (error) {
          attempts++;
          if (attempts < maxAttempts) {
            console.warn(`Retry ${attempts} failed for ${folderPath}, retrying in 1s...`);
            await delay(1000);
          } else {
            console.warn(`Failed to delete cache folder after ${attempts} attempts: ${folderPath}`, { error: error.message });
          }
        }
      }
    }
  }
  
  /**
   * Check if element is visible on page
   * @param {string} selector - CSS selector for the element
   * @param {Object} options - Options for the check
   * @returns {Promise<boolean>} True if element is visible, false otherwise
   */
  async isElementVisible(selector, options = {}) {
    const { timeout = 1000 } = options;
    try {
      await this.page.waitForSelector(selector, { visible: true, timeout });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close the browser instance
   */
  async close() {
    if (this.browser) {
      try {
  this.logger.info('Closing browser...');
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.isInitialized = false;
  this.logger.info('Browser closed successfully');
      } catch (error) {
  this.logger.error('Error closing browser', { error: error.message });
      }
    }
  }

  /**
   * Get current page URL
   */
  async getCurrentUrl() {
    await this.ensureInitialized();
    return this.page.url();
  }

  /**
   * Check if browser is healthy
   */
  async isHealthy() {
    try {
      if (!this.browser || !this.page) {
        return false;
      }

      // Try to get the page title as a health check
      await this.page.title();
      return true;
    } catch (error) {
      logger.warn('Browser health check failed', { error: error.message });
      return false;
    }
  }
}

module.exports = BrowserManager;

import puppeteer from 'puppeteer';
import { NoPageError, LoginRequiredError, SessionInvalidError, ScrapeError } from './errors.js';
import { globalLogger } from './logger.js';

const CHATGPT_URL = 'https://chatgpt.com';
const AUTH_API = '/api/auth/session';
const LOGIN_REQUIRED_INDICATORS = ['/auth/login', '/auth/authorize'];

async function positionWindowAtBottom(page) {
  try {
    // Get screen dimensions and position window at bottom with ~100px visible
    const windowMetrics = await page.evaluate(() => {
      const screen = window.screen;
      const currentWidth = window.outerWidth || 1200;
      const currentHeight = window.outerHeight || 800;

      // Position at bottom with ~100px visible
      const visibleHeight = Math.min(120, Math.max(80, screen.height * 0.1)); // 8-12% of screen height
      const y = Math.max(0, screen.height - visibleHeight);
      const x = Math.max(0, Math.min(screen.width - currentWidth, (screen.width - currentWidth) / 2)); // Center horizontally, but keep on screen

      return { x, y, width: currentWidth, height: currentHeight, screenWidth: screen.width, screenHeight: screen.height };
    });

    // Move and resize window
    await page.evaluate(({ x, y, width, height }) => {
      try {
        window.moveTo(x, y);
        window.resizeTo(width, height);
      } catch (e) {
        // Some browsers restrict moveTo/resizeTo, try alternative approaches
        console.log('Window positioning may be restricted by browser');
      }
    }, windowMetrics);
  } catch (error) {
    // Silently ignore positioning errors
  }
}

async function findChatGPTPage(pages, urlMatch = 'chatgpt') {
  for (const page of pages) {
    const url = page.url();
    if (url.includes(urlMatch) || url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
      return page;
    }
  }
  return null;
}

export async function connectToExistingChrome({
  browserURL = 'http://127.0.0.1:9222',
  findUrlMatch = 'chatgpt',
  userDataDir
} = {}) {
  try {
    const browser = await puppeteer.connect({
      browserURL,
      defaultViewport: null
    });
    globalLogger.connected(browserURL);

    const pages = await browser.pages();
    const page = await findChatGPTPage(pages, findUrlMatch);

    if (!page) {
      globalLogger.error('ChatGPT page not found', { pagesCount: pages.length });
      throw new NoPageError(`ChatGPT page not found among ${pages.length} pages`);
    }

    // Position window at bottom of screen with minimal visibility
    try {
      await positionWindowAtBottom(page);
    } catch (positionError) {
      // Ignore positioning errors for existing connections
    }

    return { browser, page };
  } catch (error) {
    globalLogger.error('Failed to connect to existing Chrome', { error: error.message });
    throw error;
  }
}

export async function launchControlledChromium({
  userDataDir,
  disableThrottlingFlags = true,
  headless = false
} = {}) {
  // Use persistent profile directory for session persistence
  const defaultUserDataDir = process.env.CHATGPT_PROFILE ||
    (process.platform === 'win32'
      ? 'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\chromium-chatgpt'
      : process.env.HOME + '/.config/chromium-chatgpt'
    );

  const actualUserDataDir = userDataDir || defaultUserDataDir;
  try {
    const args = [
      '--remote-debugging-port=9222',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-ipc-flooding-protection',
      '--disable-hang-monitor',
      '--disable-background-networking',
      '--disable-features=VizDisplayCompositor',
      '--window-size=1200,800',
      '--window-position=100,900'  // Initial position, will be adjusted by JS
    ];

    if (actualUserDataDir) {
      args.push(`--user-data-dir=${actualUserDataDir}`);
    }

    // Find Chrome executable path
    const { execSync } = await import('child_process');
    let chromePath;
    try {
      // Try to find Chrome on Windows
      chromePath = execSync('where chrome').toString().trim().split('\n')[0];
    } catch (e) {
      try {
        // Try common Chrome paths
        const fs = await import('fs');
        const paths = [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          process.env.CHROME_BIN
        ].filter(Boolean);

        for (const path of paths) {
          if (fs.existsSync(path)) {
            chromePath = path;
            break;
          }
        }
      } catch (e2) {
        throw new Error('Chrome executable not found');
      }
    }

    if (!chromePath) {
      throw new Error('Chrome executable not found');
    }

    // Launch Chrome as detached process
    const { spawn } = await import('child_process');
    const chromeProcess = spawn(chromePath, args, {
      detached: true,
      stdio: 'ignore'
    });

    // Disconnect from parent process
    chromeProcess.unref();

    // Wait for Chrome to be ready with retry loop and exponential backoff
    const maxRetries = 10;
    const baseDelay = 500;
    let browser;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      await new Promise(resolve => setTimeout(resolve, baseDelay * (attempt + 1)));

      try {
        // Verify debugging port is accessible
        const response = await fetch('http://127.0.0.1:9222/json/version');
        if (!response.ok) throw new Error('Debug port not ready');

        // Try connecting
        browser = await puppeteer.connect({
          browserURL: 'http://127.0.0.1:9222',
          defaultViewport: null
        });

        globalLogger.launched(actualUserDataDir);
        break; // Success!
      } catch (error) {
        if (attempt === maxRetries - 1) {
          globalLogger.error('Failed to launch controlled Chromium after retries', {
            error: error.message,
            attempts: maxRetries
          });
          throw error;
        }
        // Continue retrying
      }
    }

    const page = await browser.newPage();
    await page.goto(CHATGPT_URL, { waitUntil: 'networkidle2' });

    // Position window at bottom after navigation
    try {
      await positionWindowAtBottom(page);
    } catch (positionError) {
      // Ignore positioning errors for launched browsers
    }

    return { browser, page };
  } catch (error) {
    globalLogger.error('Failed to launch controlled Chromium', { error: error.message });
    throw error;
  }
}

export async function ensureLoggedIn(page) {
  try {
    const currentUrl = page.url();

    for (const indicator of LOGIN_REQUIRED_INDICATORS) {
      if (currentUrl.includes(indicator)) {
        globalLogger.loginRequired();
        throw new LoginRequiredError('Redirected to login page');
      }
    }

    // Check for the "Thanks for trying ChatGPT" login modal
    const hasLoginModal = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return false;

      const text = dialog.innerText || dialog.textContent;
      console.log(`[DEBUG] Dialog text: "${text.substring(0, 200)}..."`);
      return text.includes('Thanks for trying ChatGPT') || text.includes('Log in') || text.includes('Sign up');
    });

    if (hasLoginModal) {
      globalLogger.loginRequired();
      throw new LoginRequiredError(
        'Login modal appeared. Your session expired. ' +
        'Please: 1) Go to Chrome window, 2) Click "Log in", 3) Complete Google auth, 4) Refresh page, 5) Return to terminal and re-run test.'
      );
    }

    const chatInputExists = await page.evaluate(() => {
      return !!document.querySelector('textarea');
    });

    if (!chatInputExists) {
      globalLogger.debug('Chat input not found in DOM');
    }

    return true;
  } catch (error) {
    if (error instanceof LoginRequiredError) {
      throw error;
    }
    globalLogger.error('Error checking login status', { error: error.message });
    throw error;
  }
}

export async function oneShotLoginFlow(userDataDir) {
  let browser;
  try {
    globalLogger.info('Starting one-shot login flow', { userDataDir });

    browser = await puppeteer.launch({
      headless: false,
      userDataDir,
      args: [
        '--remote-debugging-port=9222',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    const page = await browser.newPage();
    await page.goto(CHATGPT_URL, { waitUntil: 'networkidle2' });

    globalLogger.info('Opened ChatGPT in browser. Please log in manually.');
    console.log('\n✓ ChatGPT browser window opened.');
    console.log('✓ Please complete the login process manually in the browser.');
    console.log('✓ Once logged in, press Enter here to continue...\n');

    await waitForUserInput();

    const loggedIn = await ensureLoggedIn(page);
    if (loggedIn) {
      globalLogger.info('Login successful, session persisted', { userDataDir });
      console.log('\n✓ Login successful! Session persisted.\n');
    }

    return true;
  } catch (error) {
    globalLogger.error('Login flow failed', { error: error.message });
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function waitForUserInput() {
  return new Promise((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}

export async function sendPrompt(page, prompt, debug = false, timeoutSeconds = 120, progressCallback = null, typingSpeed = null) {
  try {
    globalLogger.promptSent(prompt);

    await ensureLoggedIn(page);

    // Get the initial count of articles before sending the prompt
    const initialArticleCount = await page.evaluate(() => {
      const articles = document.querySelectorAll('article');
      return articles.length;
    });
    if (debug) console.log(`[DEBUG] Initial article count: ${initialArticleCount}`);

    // Check if there's a stuck streaming request (stop button instead of submit button)
    const stopButtonExists = await page.evaluate(() => {
      const stopButton = document.querySelector('button[id="composer-submit-button"][aria-label="Stop streaming"]');
      return !!stopButton;
    });

    if (stopButtonExists) {
      if (debug) console.log(`[DEBUG] Detected stuck streaming request (stop button present), refreshing page...`);

      // Try to find and click a refresh/new chat button
      const refreshClicked = await page.evaluate(() => {
        // Try multiple selectors for refresh/new chat buttons
        const refreshSelectors = [
          'button[data-testid="new-chat-button"]',
          'button[aria-label*="New chat"]',
          'button[aria-label*="New Chat"]',
          'button[data-testid*="refresh"]',
          'button[aria-label*="Refresh"]',
          'button[aria-label*="Reload"]',
          // Fallback: look for any button containing "new" or "refresh" text
          'button:not([disabled]):not([aria-hidden="true"])'
        ];

        for (const selector of refreshSelectors) {
          try {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
              const text = (button.textContent || button.innerText || '').toLowerCase();
              const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();

              if (text.includes('new') && text.includes('chat') ||
                  ariaLabel.includes('new') && ariaLabel.includes('chat') ||
                  text.includes('refresh') || ariaLabel.includes('refresh') ||
                  text.includes('reload') || ariaLabel.includes('reload')) {
                button.click();
                return true;
              }
            }
          } catch (e) {
            // Continue to next selector
          }
        }

        // Last resort: try to reload the page
        return false;
      });

      if (refreshClicked) {
        if (debug) console.log(`[DEBUG] Clicked refresh/new chat button, waiting for page to reload...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for page to reload
      } else {
        if (debug) console.log(`[DEBUG] No refresh button found, reloading page manually...`);
        await page.reload({ waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for reload to complete
      }

      // Re-check login status after refresh
      await ensureLoggedIn(page);
    }

    const composerSelectors = [
      '[contenteditable="true"]#prompt-textarea',
      '[contenteditable="true"][data-testid="composerInput"]',
      '[contenteditable="true"][role="textbox"]',
      'textarea'
    ];
    if (debug) console.log(`[DEBUG] Waiting for composer selectors: ${composerSelectors.join(', ')}`);

    // Ensure page is interactive before proceeding
    try {
      await page.bringToFront();
      await page.waitForFunction(() => document.visibilityState === 'visible', { timeout: 5000 });
    } catch (visibilityError) {
      if (debug) console.log(`[DEBUG] Page visibility check failed: ${visibilityError.message}`);
      // Try to bring to front again
      await page.bringToFront();
    }

    await page.waitForFunction((selectors) => {
      return selectors.some((sel) => document.querySelector(sel));
    }, { timeout: 10000 }, composerSelectors);

    const activeComposerSelector = await page.evaluate((selectors) => {
      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && !(el.offsetParent === null && el.getAttribute('aria-hidden') === 'true')) {
          try {
            el.focus();
          } catch (focusError) {
            // Ignore focus errors and continue trying
          }
          return selector;
        }
      }
      return null;
    }, composerSelectors);

    if (!activeComposerSelector) {
      throw new Error('ChatGPT composer input not found');
    }

    if (debug) console.log(`[DEBUG] Focused composer: ${activeComposerSelector}`);



  // Check for pre-existing content in both textarea and contenteditable div
  const preExisting = await page.evaluate(() => {
    const textarea = document.querySelector('textarea');
    const editableDiv = document.querySelector('[contenteditable="true"]');
    let textareaContent = textarea ? textarea.value : '';
    let divContent = editableDiv ? editableDiv.innerText : '';
    return { textareaContent, divContent };
  });

  const hasTextareaContent = preExisting.textareaContent && preExisting.textareaContent.trim().length > 0;
  const hasDivContent = preExisting.divContent && preExisting.divContent.trim().length > 0;

  if (hasTextareaContent || hasDivContent) {
    if (hasDivContent) {
      console.warn('[WARNING] There was an unsubmitted query in the textbox. Clearing it before typing new prompt.');
    } else if (debug) {
      console.log('[DEBUG] Clearing stale hidden textarea content before typing new prompt.');
    }

    if (debug && hasTextareaContent) console.log(`[DEBUG] Pre-existing textarea content: "${preExisting.textareaContent}"`);
    if (debug && hasDivContent) console.log(`[DEBUG] Pre-existing contenteditable div content: "${preExisting.divContent}"`);

    // Clear textarea
    await page.evaluate(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.value = '';
        const event = new Event('input', { bubbles: true });
        textarea.dispatchEvent(event);
      }
    });
    // Clear contenteditable div
    await page.evaluate(() => {
      const editableDiv = document.querySelector('[contenteditable="true"]');
      if (editableDiv) {
        editableDiv.innerText = '';
        editableDiv.textContent = '';
        const event = new Event('input', { bubbles: true });
        editableDiv.dispatchEvent(event);
      }
    });
  }

  try {
    await page.focus(activeComposerSelector);
  } catch (focusError) {
    if (debug) console.log(`[DEBUG] Puppeteer focus failed: ${focusError.message}`);
  }

  await typeWithDelay(page, prompt, activeComposerSelector, typingSpeed);
  if (debug) console.log(`[DEBUG] Typed prompt: ${prompt}`);

    await page.keyboard.press('Enter');
    if (debug) console.log(`[DEBUG] Pressed Enter`);

    await new Promise(resolve => setTimeout(resolve, 2000));
    if (debug) console.log(`[DEBUG] Waited 2s, starting polling`);

    let response = null;
    let attempts = 0;
    const maxAttempts = timeoutSeconds; // Configurable timeout in seconds
    let lastResponseLength = 0;
    let stableCount = 0;
    const maxStableCount = 3; // Quit if response length doesn't change for 3 consecutive polls
    let growingCount = 0;
    const maxGrowingTime = 30; // Allow up to 30 seconds of continuous growth before considering complete

    while (!response && attempts < maxAttempts) {
      if (debug) console.log(`[DEBUG] Polling attempt ${attempts + 1}/${maxAttempts}`);
      try {
        if (debug) console.log(`[DEBUG] Calling scrapeResponse...`);
        const currentResponse = await scrapeResponse(page, initialArticleCount, debug);
        if (debug) console.log(`[DEBUG] scrapeResponse returned: ${currentResponse ? 'text' : 'null'}`);

        if (currentResponse) {
          const currentLength = currentResponse.length;
          if (debug) console.log(`[DEBUG] Response length: ${currentLength} (previous: ${lastResponseLength})`);

          // Check if response is still loading (contains thinking/searching indicators at the start)
          const loadingIndicators = [
            'Searching the web',
            'Thinking',
            'Answer now',
            'Generating response',
            'Please wait',
            'Loading'
          ];

          // Response is considered loading if it starts with or contains these indicators
          const isStillLoading = loadingIndicators.some(indicator =>
            currentResponse.trim().startsWith(indicator) ||
            currentResponse.trim().includes('\n' + indicator)
          );

          if (isStillLoading) {
            if (debug) console.log(`[DEBUG] Response still loading (contains thinking/searching indicators), continuing to poll`);
            lastResponseLength = currentLength;
            stableCount = 0;
            growingCount = 0;
          } else if (currentLength === lastResponseLength) {
            stableCount++;
            growingCount = 0; // Reset growing count when stable
            if (debug) console.log(`[DEBUG] Response length stable for ${stableCount}/${maxStableCount} polls`);
            if (stableCount >= maxStableCount) {
              if (debug) console.log(`[DEBUG] Response appears complete, cleaning and validating`);
              const cleanedResponse = cleanResponse(currentResponse);
              if (cleanedResponse) {
                // Response is complete and cleaned
                response = cleanedResponse;
                break;
              } else {
                // Response still contains loading indicators, continue polling
                if (debug) console.log(`[DEBUG] Response still contains loading indicators, continuing to poll`);
                stableCount = 0;
              }
            }
          } else if (currentLength > lastResponseLength) {
            // Response is growing
            lastResponseLength = currentLength;
            stableCount = 0;
            growingCount++;

            // If response has been growing for too long, consider it potentially complete
            // This handles very long responses that might be generated slowly
            if (growingCount >= maxGrowingTime) {
              if (debug) console.log(`[DEBUG] Response has been growing for ${growingCount}s, checking if submit button is available`);

              // Check if the submit button is available again (indicating ChatGPT is ready for next input)
              const submitButtonAvailable = await page.evaluate(() => {
                const submitButton = document.querySelector('button[data-testid="send-button"]') ||
                                   document.querySelector('button[aria-label*="Send"]') ||
                                   document.querySelector('button[type="submit"]');
                return !!submitButton && !submitButton.disabled;
              });

              if (submitButtonAvailable) {
                if (debug) console.log(`[DEBUG] Submit button available, response appears complete`);
                const cleanedResponse = cleanResponse(currentResponse);
                if (cleanedResponse) {
                  response = cleanedResponse;
                  break;
                } else {
                  if (debug) console.log(`[DEBUG] Response still contains loading indicators despite button available, continuing to poll`);
                  // Continue polling even if button is available, since response still has loading text
                }
              }
            }

            if (debug) {
              console.log(`[DEBUG] Response is still growing (${growingCount}s)`);
            } else if (progressCallback) {
              progressCallback(currentLength);
            }
          } else {
            // Response got shorter (unlikely but handle it)
            if (debug) console.log(`[DEBUG] Response length decreased, resetting counters`);
            lastResponseLength = currentLength;
            stableCount = 0;
            growingCount = 0;
          }
        } else {
          if (debug) console.log(`[DEBUG] No response yet`);
          stableCount = 0;
          growingCount = 0;
        }
      } catch (error) {
        if (debug) console.log(`[DEBUG] Scrape error caught: ${error.message}`);
        stableCount = 0;
        growingCount = 0;
        // Response not ready yet
      }
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!response) {
      const errorMsg = `TIMEOUT: ChatGPT response took longer than ${timeoutSeconds} seconds to complete. ` +
        `This usually means the response is very long or ChatGPT is slow. ` +
        `Try increasing the timeout with --timeout ${Math.max(timeoutSeconds + 60, 180)} (or higher) and retry. ` +
        `Current timeout was: ${timeoutSeconds}s`;
      throw new ScrapeError(errorMsg);
    }

    globalLogger.responseReceived(response);
    return response;
  } catch (error) {
    if (error instanceof LoginRequiredError || error instanceof SessionInvalidError) {
      throw error;
    }
    globalLogger.error('Failed to send prompt', { error: error.message });
    throw error;
  }
}

async function typeWithDelay(page, text, selector, typingSpeed = null) {
  // If typingSpeed is null or 0 (default), set the value in a single step and fire React-friendly events
  if (typingSpeed === null || typingSpeed === 0) {
    await page.evaluate((textValue, preferredSelector) => {
      const candidateSelectors = [
        preferredSelector,
        '[contenteditable="true"]#prompt-textarea',
        '[contenteditable="true"][data-testid="composerInput"]',
        '[contenteditable="true"][role="textbox"]',
        '[contenteditable="true"]',
        'textarea'
      ].filter(Boolean);

      const findFirst = (selectors) => {
        for (const sel of selectors) {
          if (!sel) continue;
          const el = document.querySelector(sel);
          if (el) {
            return el;
          }
        }
        return null;
      };

      const composerTarget = findFirst(candidateSelectors);
      if (!composerTarget) {
        throw new Error('Unable to locate ChatGPT composer input');
      }

      const textarea = document.querySelector('textarea');

      const setTextareaValue = (el) => {
        if (!el) return;
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(el, textValue);
        } else {
          el.value = textValue;
        }
        el.setAttribute('data-textgenhub-last-paste-length', String(textValue.length));
      };

      const populateContentEditable = (el) => {
        if (!el || el.getAttribute('contenteditable') !== 'true') {
          return false;
        }

        try {
          el.focus();
        } catch (focusError) {
          // Ignore focus errors
        }

        // Clear existing content and rebuild paragraphs to keep ProseMirror happy
        while (el.firstChild) {
          el.removeChild(el.firstChild);
        }

        const doc = el.ownerDocument;
        const paragraphs = textValue.split('\n');
        paragraphs.forEach((line, index) => {
          const p = doc.createElement('p');
          if (line.length > 0) {
            p.appendChild(doc.createTextNode(line));
          } else {
            p.appendChild(doc.createElement('br'));
          }

          const trailingBreak = doc.createElement('br');
          trailingBreak.classList.add('ProseMirror-trailingBreak');
          p.appendChild(trailingBreak);
          p.classList.remove('placeholder');
          el.appendChild(p);
        });

        el.setAttribute('data-textgenhub-last-paste-length', String(textValue.length));
        return true;
      };

      const dispatchEvents = (el) => {
        if (!el) return;
        const reactFriendlyEvent = (eventName, options) => {
          const ctor = eventName === 'input' && typeof InputEvent === 'function' ? InputEvent : Event;
          const event = new ctor(eventName, options);
          el.dispatchEvent(event);
        };

        reactFriendlyEvent('beforeinput', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertFromPaste',
          data: textValue
        });

        reactFriendlyEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertFromPaste',
          data: textValue
        });

        reactFriendlyEvent('change', { bubbles: true });
      };

      const wroteEditable = populateContentEditable(composerTarget);
      if (!wroteEditable && composerTarget.tagName === 'TEXTAREA') {
        setTextareaValue(composerTarget);
      }

      if (textarea && textarea !== composerTarget) {
        setTextareaValue(textarea);
      }

      dispatchEvents(composerTarget);
      if (textarea && textarea !== composerTarget) {
        dispatchEvents(textarea);
      }
    }, text, selector);

    // Give React time to reconcile virtual DOM after programmatic input
    await new Promise(resolve => setTimeout(resolve, 350));
  } else {
    // Use character-by-character typing when typingSpeed > 0
    for (const char of text) {
      if (char === '\n') {
        // Use Shift+Enter for newlines to create line breaks without submitting
        await page.keyboard.down('Shift');
        await page.keyboard.press('Enter');
        await page.keyboard.up('Shift');
      } else {
        // Type regular characters
        await page.type(selector, char);
      }
      // Convert typing speed (seconds per character) to milliseconds
      const baseDelay = typingSpeed * 1000;
      // Apply ±20% randomization around the base delay
      const delay = Math.random() * (baseDelay * 0.2) + (baseDelay * 0.8);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function scrapeResponse(page, initialArticleCount = 0, debug = false) {
  try {
    const result = await page.evaluate((initialCount) => {
      const debug = { articles: [], containers: {}, text: null, error: null };

      try {
        // Get all articles on the page
        const allArticles = document.querySelectorAll('article');
        debug.articles = Array.from(allArticles).map((art, i) => {
          const text = (art.innerText || art.textContent || '').trim();
          return { index: i, text: text.substring(0, 100), length: text.length };
        });

        // Try the specific container
        let container = document.querySelector('div.flex.flex-col.text-sm[class*="thread-xl:pt-header-height"][class*="pb-25"]');
        if (!container) {
          container = document.querySelector('div.flex.flex-col.text-sm[class*="thread-xl:pt-header-height"][class*="pb-25"]');
        }
        if (!container) {
          const divs = document.querySelectorAll('div.flex.flex-col');
          for (const div of divs) {
            if (div.classList.contains('pb-25')) {
              container = div;
              break;
            }
          }
        }

        debug.containers.found = !!container;

        if (!container) {
          debug.error = 'No container found';
          return debug;
        }

        const articles = container.querySelectorAll('article');
        debug.containers.articlesCount = articles.length;

        if (articles.length === 0) {
          const containerText = (container.innerText || container.textContent || '').trim();
          debug.text = containerText;
          return debug;
        }

        // Only consider articles that appeared after the prompt was sent
        const newArticles = Array.from(articles).slice(initialCount);
        debug.containers.newArticlesCount = newArticles.length;

        if (newArticles.length === 0) {
          debug.error = 'No new articles found since prompt was sent';
          return debug;
        }

        // Get the last new article (the most recent response)
        const lastArticle = newArticles[newArticles.length - 1];
        const text = (lastArticle.innerText || lastArticle.textContent || '').trim();
        debug.text = text;

        // Don't check for placeholders here - let polling logic handle it
        debug.valid = true;
        return debug;
      } catch (e) {
        debug.error = e.message;
        return debug;
      }
    });

    // Log debug info in Node.js
    if (debug) {
      console.log(`[DEBUG] Total articles on page: ${result.articles.length}`);
      result.articles.forEach(art => {
        console.log(`[DEBUG] Article ${art.index}: "${art.text}..." (${art.length} chars)`);
      });
      console.log(`[DEBUG] Container found: ${result.containers.found}`);
      console.log(`[DEBUG] Articles in container: ${result.containers.articlesCount || 0}`);
      console.log(`[DEBUG] New articles since prompt: ${result.containers.newArticlesCount || 0}`);
      if (result.text) {
        console.log(`[DEBUG] Response text: "${result.text.substring(0, 200)}..." (${result.text.length} chars)`);
      }
      if (result.placeholder) {
        console.log(`[DEBUG] Placeholder detected: "${result.placeholder}"`);
        return null;
      }
      if (result.error) {
        console.log(`[DEBUG] Error: ${result.error}`);
        throw new ScrapeError(result.error);
      }
      if (result.valid) {
        console.log(`[DEBUG] Valid response found`);
        return result.text;
      }

      console.log(`[DEBUG] No valid response`);
    } else {
      // Non-debug mode: just return the text if valid
      if (result.valid) {
        return result.text;
      }
      if (result.placeholder) {
        return null;
      }
      if (result.error) {
        throw new ScrapeError(result.error);
      }
      return null;
    }
  } catch (error) {
    throw new ScrapeError(error.message);
  }
}

function cleanResponse(response) {
  if (!response) return response;

  let cleaned = response.trim();

  // Check for loading indicators that should signal incomplete response
  const loadingIndicators = [
    'Searching the web',
    'Thinking',
    'Answer now',
    'Generating response',
    'Please wait',
    'Loading'
  ];

  // If response starts with or contains loading indicators, it's not ready yet
  for (const indicator of loadingIndicators) {
    if (cleaned.startsWith(indicator) || cleaned.includes('\n' + indicator)) {
      return null; // Signal that response is still loading
    }
  }

  // Remove common ChatGPT prefixes
  const prefixes = [
    /^ChatGPT said:\s*/,
    /^ChatGPT said:\s*\n*/,
    /^ChatGPT said:\s*\n*Thought for \d+s\s*\n*/,
    /^ChatGPT said:\s*\n*Thinking\s*\n*/,
    /^ChatGPT said:\s*\n*Generating response\s*\n*/,
  ];

  for (const prefix of prefixes) {
    cleaned = cleaned.replace(prefix, '');
  }

  // Remove leading/trailing whitespace again
  return cleaned.trim();
}

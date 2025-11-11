// Content script for ChatGPT CLI automation
console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Content script LOADING on URL:`, window.location.href);

let ws = null;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 10;
const WS_URL = 'ws://127.0.0.1:8765';
const pendingNetworkResolvers = new Map();
const NETWORK_TIMEOUT_MS = 240000;

function connectToServer() {
    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] connectToServer() called on URL:`, window.location.href);
    if (connectionAttempts >= MAX_ATTEMPTS) {
        console.error(`[${new Date().toISOString()}] [ChatGPT CLI] Max connection attempts reached`);
        return;
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Already connected`);
        return;
    }

    connectionAttempts++;
    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Attempting connection ${connectionAttempts}/${MAX_ATTEMPTS} to ${WS_URL}`);

    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] WebSocket connected!`);
            connectionAttempts = 0;

            // Register with server
            const msg = JSON.stringify({ type: 'extension_register' });
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Sending registration...`);
            ws.send(msg);
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Registered with server`);
        };

        ws.onmessage = (event) => {
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: Raw WebSocket message received:`, event.data);
            try {
                console.log(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: About to parse JSON...`);
                const data = JSON.parse(event.data);
                console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Received WebSocket message type:`, data.type, 'messageId:', data.messageId);
                console.log(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: Full message data:`, JSON.stringify(data));

                if (data.type === 'ack') {
                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Received ACK, status:`, data.status);
                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Handler still alive after ACK processing`);
                    // No action needed for ack messages, just acknowledge and continue listening
                } else if (data.type === 'inject') {
                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Injecting message with ID:`, data.messageId);
                    // Handle async operation without awaiting in the event handler
                    injectAndWaitForResponse(data.messageId, data.message, data.output_format || 'json').then(response => {
                        console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Got response, sending back...`);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'response',
                                messageId: data.messageId,
                                response: response.text,
                                html: response.html
                            }));
                            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Response sent`);
                        } else {
                            console.error(`[${new Date().toISOString()}] [ChatGPT CLI] WebSocket not open when sending response, state: ${ws?.readyState}`);
                            console.error(`[${new Date().toISOString()}] [ChatGPT CLI] Attempting to reconnect...`);
                            // Attempt to send anyway or reconnect
                            if (ws) {
                                try {
                                    ws.send(JSON.stringify({
                                        type: 'response',
                                        messageId: data.messageId,
                                        response: response.text,
                                        html: response.html
                                    }));
                                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Response sent on recovered connection`);
                                } catch (sendErr) {
                                    console.error(`[${new Date().toISOString()}] [ChatGPT CLI] Failed to send on recovered connection:`, sendErr);
                                }
                            }
                        }
                    }).catch(err => {
                        console.error(`[${new Date().toISOString()}] [ChatGPT CLI] Error in inject handler:`, err);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'response',
                                messageId: data.messageId,
                                response: 'ERROR: ' + err.message
                            }));
                        }
                    });
                } else if (data.type === 'focus_tab') {
                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: Content script received focus_tab with ID:`, data.messageId);
                    // Forward to background script
                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: Forwarding focus_tab to background script`);
                    chrome.runtime.sendMessage({
                        type: 'focus_tab',
                        messageId: data.messageId
                    }, (response) => {
                        console.log(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: Background script response:`, response);
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'response',
                                messageId: data.messageId,
                                success: response.success,
                                error: response.error
                            }));
                        }
                    });
                } else if (data.type === 'debug_tabs') {
                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: Content script received debug_tabs with ID:`, data.messageId);
                    // Forward to background script
                    chrome.runtime.sendMessage({
                        type: 'debug_tabs',
                        messageId: data.messageId
                    }, (response) => {
                        console.log(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: Background script debug_tabs response:`, response);
                        if (chrome.runtime.lastError) {
                            console.error(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: Chrome runtime error:`, chrome.runtime.lastError);
                            if (ws && ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({
                                    type: 'response',
                                    messageId: data.messageId,
                                    response: 'ERROR: ' + chrome.runtime.lastError.message
                                }));
                            }
                            return;
                        }
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: 'response',
                                messageId: data.messageId,
                                tabs: response.tabs,
                                tab_count: response.tab_count
                            }));
                        }
                    });
                } else {
                    console.warn(`[${new Date().toISOString()}] [ChatGPT CLI] Unhandled message type: ${data.type}`);
                }
            } catch (e) {
                console.error('[ChatGPT CLI] Error in message handler:', e);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'response',
                        response: 'ERROR: ' + e.message
                    }));
                }
            }
        };

        ws.onerror = (error) => {
            console.error(`[${new Date().toISOString()}] [ChatGPT CLI] WebSocket error:`, error);
            console.error(`[${new Date().toISOString()}] [ChatGPT CLI] Error details:`, error?.message, error?.code);
        };

        ws.onclose = (event) => {
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] WebSocket closed!`);
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Close code:`, event.code);
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Close reason:`, event.reason);
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Was clean:`, event.wasClean);
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Reconnecting in 3s...`);
            ws = null;
            setTimeout(connectToServer, 3000);
        };
    } catch (e) {
        console.error(`[${new Date().toISOString()}] [ChatGPT CLI] Connection error:`, e);
        setTimeout(connectToServer, 3000);
    }
}

chrome.runtime.onMessage.addListener((request) => {
    if (request?.type !== 'sse_response' || !request.messageId) {
        return;
    }

    const resolver = pendingNetworkResolvers.get(request.messageId);
    if (!resolver) {
        return;
    }

    pendingNetworkResolvers.delete(request.messageId);
    clearTimeout(resolver.timeoutHandle);

    if (request.error) {
        console.error('[ChatGPT CLI] SSE response reported error:', request.error);
        resolver.reject(new Error(request.error));
        return;
    }

    const text = request.text || '';
    const html = convertMarkdownToHtml(text);

    resolver.resolve({ text, html, source: 'network', reason: request.reason || 'complete' });
});

// NEW: Helper function to find element with retry
async function findElementWithRetry(selectors, maxAttempts = 10, delayMs = 200) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        for (const selector of selectors) {
            try {
                const el = document.querySelector(selector);
                if (el && !el.disabled) {
                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Found element with selector: "${selector}" on attempt ${attempt + 1}`);
                    return el;
                }
            } catch (e) {
                // Selector might be invalid, skip it
            }
        }

        if (attempt < maxAttempts - 1) {
            await new Promise(r => setTimeout(r, delayMs));
            console.log(`[ChatGPT CLI] Retry ${attempt + 1}/${maxAttempts} finding element...`);
        }
    }

    return null;
}

// NEW: Check and report tab visibility
function checkTabVisibility() {
    const status = {
        hidden: document.hidden,
        visibilityState: document.visibilityState,
        readyState: document.readyState
    };
    console.log('[ChatGPT CLI] Tab visibility:', JSON.stringify(status));
    return status;
}

function registerPromptWithBackground(messageId, prompt, outputFormat) {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage(
                {
                    type: 'register_prompt',
                    messageId,
                    prompt,
                    output_format: outputFormat,
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[ChatGPT CLI] Failed to register prompt with background:', chrome.runtime.lastError.message);
                        resolve(false);
                        return;
                    }
                    resolve(response?.success === true);
                }
            );
        } catch (e) {
            console.error('[ChatGPT CLI] Exception calling chrome.runtime.sendMessage:', e.message);
            resolve(false);
        }
    });
}

function waitForNetworkResponse(messageId) {
    return new Promise((resolve, reject) => {
        const timeoutHandle = setTimeout(() => {
            if (pendingNetworkResolvers.has(messageId)) {
                pendingNetworkResolvers.delete(messageId);
            }
            reject(new Error('network capture timeout'));
        }, NETWORK_TIMEOUT_MS);

        pendingNetworkResolvers.set(messageId, {
            resolve,
            reject,
            timeoutHandle,
        });
    });
}

function cleanupNetworkResolver(messageId) {
    const resolver = pendingNetworkResolvers.get(messageId);
    if (resolver) {
        clearTimeout(resolver.timeoutHandle);
        pendingNetworkResolvers.delete(messageId);
    }
}

function requestTabActivation() {
    return new Promise((resolve) => {
        try {
            chrome.runtime.sendMessage({ type: 'activate_tab' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('[ChatGPT CLI] Tab activation request failed:', chrome.runtime.lastError.message);
                }
                resolve(response?.success || false);
            });
        } catch (e) {
            console.error('[ChatGPT CLI] Exception requesting tab activation:', e.message);
            resolve(false);
        }
    });
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function applyInlineMarkdown(text) {
    let output = escapeHtml(text);
    output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    output = output.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    output = output.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    output = output.replace(/_([^_]+)_/g, '<em>$1</em>');
    output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
    output = output.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "<a href='$2' target='_blank' rel='noopener noreferrer'>$1</a>");
    return output;
}

function convertMarkdownToHtml(markdown) {
    if (!markdown) {
        return '';
    }

    const lines = markdown.split('\n');
    const htmlParts = [];
    let inCodeBlock = false;
    let codeBuffer = [];
    let listType = null;
    let listBuffer = [];
    let paragraphBuffer = [];

    const flushParagraph = () => {
        if (paragraphBuffer.length === 0) {
            return;
        }
        const paragraphText = paragraphBuffer.join(' ').trim();
        if (paragraphText.length > 0) {
            htmlParts.push(`<p>${applyInlineMarkdown(paragraphText)}</p>`);
        }
        paragraphBuffer = [];
    };

    const flushList = () => {
        if (!listType || listBuffer.length === 0) {
            return;
        }
        const items = listBuffer.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join('');
        htmlParts.push(`<${listType}>${items}</${listType}>`);
        listType = null;
        listBuffer = [];
    };

    const flushCodeBlock = () => {
        if (!inCodeBlock) {
            return;
        }
        const codeContent = codeBuffer.join('\n');
        htmlParts.push(`<pre><code>${escapeHtml(codeContent)}</code></pre>`);
        inCodeBlock = false;
        codeBuffer = [];
    };

    for (const rawLine of lines) {
        const line = rawLine;
        const trimmed = line.trim();

        const codeBlockMatch = trimmed.match(/^```/);
        if (codeBlockMatch) {
            if (inCodeBlock) {
                flushCodeBlock();
            } else {
                flushParagraph();
                flushList();
                inCodeBlock = true;
                codeBuffer = [];
            }
            continue;
        }

        if (inCodeBlock) {
            codeBuffer.push(line);
            continue;
        }

        if (!trimmed) {
            flushParagraph();
            flushList();
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = headingMatch[1].length;
            const content = applyInlineMarkdown(headingMatch[2]);
            htmlParts.push(`<h${level}>${content}</h${level}>`);
            continue;
        }

        if (trimmed.startsWith('>')) {
            flushParagraph();
            flushList();
            const quoteContent = applyInlineMarkdown(trimmed.replace(/^>\s?/, ''));
            htmlParts.push(`<blockquote>${quoteContent}</blockquote>`);
            continue;
        }

        const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
        if (orderedMatch) {
            if (listType !== 'ol') {
                flushParagraph();
                flushList();
                listType = 'ol';
                listBuffer = [];
            }
            listBuffer.push(orderedMatch[1]);
            continue;
        }

        const unorderedMatch = trimmed.match(/^[\-*+]\s+(.*)$/);
        if (unorderedMatch) {
            if (listType !== 'ul') {
                flushParagraph();
                flushList();
                listType = 'ul';
                listBuffer = [];
            }
            listBuffer.push(unorderedMatch[1]);
            continue;
        }

        paragraphBuffer.push(trimmed);
    }

    flushCodeBlock();
    flushList();
    flushParagraph();

    return htmlParts.join('');
}

async function injectAndWaitForResponse(messageId, message, outputFormat = 'json') {
    try {
        console.log('[ChatGPT CLI] ===== INJECT START =====');
        console.log('[ChatGPT CLI] Message:', message.substring(0, 100));
        console.log('[ChatGPT CLI] Output format:', outputFormat);

        const visibility = checkTabVisibility();
        if (document.hidden) {
            console.warn('[ChatGPT CLI] Tab is hidden, requesting activation...');
            await requestTabActivation();
            await new Promise(r => setTimeout(r, 500));
            console.log('[ChatGPT CLI] Tab activation requested, current status:', document.hidden ? 'still hidden' : 'visible');
        }

        const textareaSelectors = [
            '#prompt-textarea',
            'textarea[placeholder*="Message"]',
            '[contenteditable="true"]'
        ];

        let inputField = await findElementWithRetry(textareaSelectors, 10, 200);

        if (!inputField) {
            console.error('[ChatGPT CLI] Input field not found after 10 attempts');
            return { text: 'ERROR: input field not found after retries', html: '', source: 'error' };
        }

        console.log('[ChatGPT CLI] Input field found, type:', inputField.tagName);

        if (inputField.contentEditable === 'true') {
            inputField.textContent = '';
            inputField.innerHTML = message;
        } else {
            inputField.value = message;
        }

        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));

        console.log('[ChatGPT CLI] Message typed, waiting 500ms...');
        await new Promise(r => setTimeout(r, 500));

        const sendButtonSelectors = [
            'button[data-testid="send-button"]',
            'button[id="composer-submit-button"]',
            'button[aria-label="Send prompt"]',
            'button.composer-submit-btn'
        ];

        const sendButton = await findElementWithRetry(sendButtonSelectors, 10, 200);

        if (!sendButton) {
            console.error('[ChatGPT CLI] Send button not found after 10 attempts');
            return { text: 'ERROR: send button not found after retries', html: '', source: 'error' };
        }

        console.log('[ChatGPT CLI] Send button found, clicking...');
        sendButton.click();
        console.log('[ChatGPT CLI] Send button clicked');

        console.log('[ChatGPT CLI] Waiting for response via DOM polling...');
        const response = await waitForChatResponseDom(outputFormat);

        console.log('[ChatGPT CLI] Response received from', response?.source || 'dom');
        console.log('[ChatGPT CLI] ===== INJECT END =====');

        return response;
    } catch (e) {
        console.error('[ChatGPT CLI] Error in inject:', e);
        cleanupNetworkResolver(messageId);
        return { text: 'ERROR: ' + e.message, html: '', source: 'error' };
    }
}function findSendButton() {
    // Try exact selectors first
    let btn = document.querySelector('button[data-testid="send-button"]');
    if (btn && !btn.disabled) {
        console.log('[ChatGPT CLI] Found via [data-testid="send-button"]');
        return btn;
    }

    btn = document.querySelector('button[id="composer-submit-button"]');
    if (btn && !btn.disabled) {
        console.log('[ChatGPT CLI] Found via [id="composer-submit-button"]');
        return btn;
    }

    btn = document.querySelector('button[aria-label="Send prompt"]');
    if (btn && !btn.disabled) {
        console.log('[ChatGPT CLI] Found via [aria-label="Send prompt"]');
        return btn;
    }

    // Try class selectors
    btn = document.querySelector('button.composer-submit-btn');
    if (btn && !btn.disabled) {
        console.log('[ChatGPT CLI] Found via .composer-submit-btn');
        return btn;
    }

    // Fallback: look for submit button in form
    const form = document.querySelector('form');
    if (form) {
        const buttons = Array.from(form.querySelectorAll('button')).filter(b => !b.disabled);
        if (buttons.length > 0) {
            console.log('[ChatGPT CLI] Found button in form');
            return buttons[buttons.length - 1];
        }
    }

    console.log('[ChatGPT CLI] No send button found');
    return null;
}

async function waitForChatResponseDom(outputFormat = 'json', maxWait = 300000) {
    const startTime = Date.now();
    let lastResponseText = '';
    let lastResponseHtml = '';
    let stableCount = 0;
    let pollCount = 0;
    let userPromptArticleFound = false;
    let lastReportedLength = 0;
    let lastKeepalive = Date.now();

    console.log('[ChatGPT CLI] ===== DOM RESPONSE POLLING START =====');
    console.log('[ChatGPT CLI] Output format:', outputFormat);

    while (Date.now() - startTime < maxWait) {
        pollCount++;
        
        // Send keep-alive ping every 10 seconds to keep server connection alive
        const now = Date.now();
        if (now - lastKeepalive > 10000) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify({ type: 'ping' }));
                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Sent keep-alive ping`);
                } catch (e) {
                    console.warn('[ChatGPT CLI] Failed to send keep-alive:', e.message);
                }
            }
            lastKeepalive = now;
        }

        // Find all article elements (they're <article> tags, not role=article)
        const articles = document.querySelectorAll('article');
        console.log(`[ChatGPT CLI] Poll ${pollCount}: Found ${articles.length} <article> tags`);

        if (articles.length > 0) {
            // Find the LAST user's prompt article by searching for the prompt text
            // We need the most recent turn, not the first one
            let userArticleIndex = -1;
            let assistantArticle = null;

            // Search backwards to find the most recent user prompt article
            for (let i = articles.length - 1; i >= 0; i--) {
                const article = articles[i];

                // Look for our message - it should contain "whitespace-pre-wrap" div with the actual prompt
                const promptDiv = article.querySelector('[class*="whitespace-pre-wrap"]');
                if (promptDiv && promptDiv.textContent) {
                    const promptText = promptDiv.textContent.trim();
                    console.log(`[ChatGPT CLI] Found most recent user message at index ${i}, text: "${promptText.substring(0, 50)}..."`);
                    userArticleIndex = i;
                    break;
                }
            }

            // If we found user prompt, get the next article (which should be assistant's response)
            if (userArticleIndex !== -1) {
                userPromptArticleFound = true;
                console.log(`[ChatGPT CLI] Most recent user prompt found at index ${userArticleIndex}, looking for assistant response at index ${userArticleIndex + 1}`);

                if (userArticleIndex + 1 < articles.length) {
                    assistantArticle = articles[userArticleIndex + 1];
                    console.log('[ChatGPT CLI] Found potential assistant article');
                }
            } else {
                console.log('[ChatGPT CLI] User prompt article not yet found');
            }

            // Extract text and HTML from assistant article
            if (assistantArticle) {
                let text = '';
                // Approach 1: Try to find markdown content div (most reliable)
                let markdownDiv = assistantArticle.querySelector('.markdown');
                if (!markdownDiv) {
                    markdownDiv = assistantArticle.querySelector('[class*="markdown"]');
                }

                if (markdownDiv) {
                    text = (markdownDiv.innerText || markdownDiv.textContent || '').trim();
                    console.log(`[ChatGPT CLI] Extracted from markdown div: ${text.length} chars`);
                } else {
                    // Approach 2: Fallback to full article text but exclude UI elements
                    const allText = (assistantArticle.innerText || assistantArticle.textContent || '').trim();
                    // Remove "ChatGPT said:" and similar UI text
                    text = allText.replace(/^ChatGPT said:\s*/i, '').replace(/^\s*ChatGPT said\s*/i, '').trim();
                    console.log(`[ChatGPT CLI] Extracted from full article (filtered): ${text.length} chars`);
                }

                // Approach 3: If still short/incomplete, try getting all text nodes but filter aggressively
                if (text.length < 50) {
                    const textNodes = [];
                    const walker = document.createTreeWalker(
                        assistantArticle,
                        NodeFilter.SHOW_TEXT,
                        null,
                        false
                    );
                    let node;
                    while (node = walker.nextNode()) {
                        const content = node.textContent.trim();
                        // Filter out UI text, thinking states, and short fragments
                        if (content && content.length > 0 &&
                            content !== 'ChatGPT said:' &&
                            !content.toLowerCase().includes('chatgpt said') &&
                            !content.toLowerCase().includes('thinking') &&
                            !content.toLowerCase().includes('typing') &&
                            !content.toLowerCase().includes('searching') &&
                            !/^\.\.\.$/.test(content) &&
                            content.length > 3) {  // Filter out very short fragments
                            textNodes.push(content);
                        }
                    }
                    if (textNodes.length > 0) {
                        text = textNodes.join(' ').trim();
                        console.log(`[ChatGPT CLI] Extracted from filtered text nodes: ${text.length} chars`);
                    }
                }

                const html = outputFormat === 'html' ? assistantArticle.outerHTML : '';

                console.log(`[ChatGPT CLI] Assistant text length: ${text.length}, previous: ${lastResponseText.length}`);

                // Filter out interim/placeholder states such as "Thinking" or short ellipses
                const low = text.toLowerCase();
                const isThinking = (low.includes('thinking') || low.includes('thinking...') || low.includes('searching the web') || /^\.\.\.$/.test(text.trim()) || text.trim().toLowerCase() === 'typing' || text.includes('ChatGPT said') || low.startsWith('chatgpt said')) && text.length < 100;

                if (isThinking) {
                    console.log(`[ChatGPT CLI] Detected interim/"Thinking" state, skipping and continuing to poll...`);
                    // CRITICAL: Do NOT set lastResponseText; skip this poll and continue waiting
                    stableCount = 0;
                } else if (text && text !== lastResponseText) {
                    // Check if text has changed (regardless of length, but filter out thinking states above)
                    lastResponseText = text;
                    lastResponseHtml = html;
                    stableCount = 0;
                    console.log(`[ChatGPT CLI] Response text CHANGED. New length: ${text.length} (was ${lastReportedLength})`);
                    console.log(`[ChatGPT CLI] First 100 chars: "${text.substring(0, 100)}..."`);
                    lastReportedLength = text.length;
                } else if (text === lastResponseText && text.length > 0) {
                    stableCount++;
                    if (stableCount % 3 === 1) {
                        console.log(`[ChatGPT CLI] Response text STABLE (count: ${stableCount}/15, length: ${text.length})`);
                    }

                    // Need 15 consecutive stable readings (7.5 seconds) to confirm generation complete
                    // This prevents returning incomplete responses mid-stream
                    if (stableCount >= 15) {
                        console.log('[ChatGPT CLI] Response confirmed STABLE, returning');
                        console.log(`[ChatGPT CLI] Final response length: ${text.length}`);
                        console.log(`[ChatGPT CLI] First 150 chars: "${text.substring(0, 150)}..."`);
                        console.log('[ChatGPT CLI] ===== DOM RESPONSE POLLING END (SUCCESS) =====');
                        return { text: text, html: lastResponseHtml, source: 'dom' };
                    }
                }
            } else if (userPromptArticleFound) {
                console.log('[ChatGPT CLI] Waiting for assistant article to appear after user prompt...');
            }
        } else {
            console.log('[ChatGPT CLI] No <article> elements found on page');
        }

        // Poll every 200ms (5x per second) for responsive UI and faster completion detection
        // This is critical when the tab is in focus - we want near-real-time updates
        await new Promise(r => setTimeout(r, 200));
    }

    console.error('[ChatGPT CLI] Timeout waiting for response after', maxWait, 'ms');
    console.error('[ChatGPT CLI] Last response text length:', lastResponseText.length);
    console.log('[ChatGPT CLI] ===== DOM RESPONSE POLLING END (TIMEOUT) =====');
    return { text: lastResponseText || 'ERROR: timeout waiting for response', html: lastResponseHtml, source: 'dom' };
}

// Connect when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[ChatGPT CLI] Page loaded, connecting...');
        connectToServer();

        // Test background script communication
        console.log('[ChatGPT CLI] Testing background script communication...');
        chrome.runtime.sendMessage({ type: 'ping' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[ChatGPT CLI] Background script not available:', chrome.runtime.lastError.message);
                console.error('[ChatGPT CLI] Extension context may be invalid - please reload the page');
            } else {
                console.log('[ChatGPT CLI] Background script ping response:', response);
            }
        });
        
        // Add heartbeat to monitor WebSocket state
        setInterval(() => {
            if (ws) {
                console.log(`[${new Date().toISOString()}] [ChatGPT CLI] HEARTBEAT: WebSocket state = ${ws.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
            } else {
                console.log(`[${new Date().toISOString()}] [ChatGPT CLI] HEARTBEAT: WebSocket is null`);
            }
        }, 2000);
    });
} else {
    console.log('[ChatGPT CLI] Page already loaded, connecting...');
    connectToServer();

    // Test background script communication
    console.log('[ChatGPT CLI] Testing background script communication...');
    chrome.runtime.sendMessage({ type: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
            console.error('[ChatGPT CLI] Background script not available:', chrome.runtime.lastError.message);
            console.error('[ChatGPT CLI] Extension context may be invalid - please reload the page');
        } else {
            console.log('[ChatGPT CLI] Background script ping response:', response);
        }
    });
    
    // Add heartbeat to monitor WebSocket state
    setInterval(() => {
        if (ws) {
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] HEARTBEAT: WebSocket state = ${ws.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);
        } else {
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] HEARTBEAT: WebSocket is null`);
        }
    }, 2000);
}

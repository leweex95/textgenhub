// Content script for ChatGPT CLI automation
console.log('[ChatGPT CLI] Content script LOADING');

let ws = null;
let connectionAttempts = 0;
const MAX_ATTEMPTS = 10;
const WS_URL = 'ws://127.0.0.1:8765';

function connectToServer() {
    if (connectionAttempts >= MAX_ATTEMPTS) {
        console.error('[ChatGPT CLI] Max connection attempts reached');
        return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('[ChatGPT CLI] Already connected');
        return;
    }
    
    connectionAttempts++;
    console.log(`[ChatGPT CLI] Attempting connection ${connectionAttempts}/${MAX_ATTEMPTS} to ${WS_URL}`);
    
    try {
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
            console.log('[ChatGPT CLI] WebSocket connected!');
            connectionAttempts = 0;
            
            // Register with server
            const msg = JSON.stringify({ type: 'extension_register' });
            console.log('[ChatGPT CLI] Sending registration...');
            ws.send(msg);
            console.log('[ChatGPT CLI] Registered with server');
        };
        
        ws.onmessage = async (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('[ChatGPT CLI] Received message type:', data.type);
                
                if (data.type === 'inject') {
                    console.log('[ChatGPT CLI] Injecting message');
                    const response = await injectAndWaitForResponse(data.message, data.output_format || 'json');
                    console.log('[ChatGPT CLI] Got response, sending back...');
                    ws.send(JSON.stringify({
                        type: 'response',
                        response: response.text,
                        html: response.html
                    }));
                    console.log('[ChatGPT CLI] Response sent');
                }
            } catch (e) {
                console.error('[ChatGPT CLI] Error in message handler:', e);
                ws.send(JSON.stringify({
                    type: 'response',
                    response: 'ERROR: ' + e.message
                }));
            }
        };
        
        ws.onerror = (error) => {
            console.error('[ChatGPT CLI] WebSocket error:', error);
        };
        
        ws.onclose = (event) => {
            console.log('[ChatGPT CLI] WebSocket closed, reconnecting in 3s...');
            ws = null;
            setTimeout(connectToServer, 3000);
        };
    } catch (e) {
        console.error('[ChatGPT CLI] Connection error:', e);
        setTimeout(connectToServer, 3000);
    }
}

async function injectAndWaitForResponse(message, outputFormat = 'json') {
    try {
        console.log('[ChatGPT CLI] ===== INJECT START =====');
        console.log('[ChatGPT CLI] Message:', message.substring(0, 100));
        console.log('[ChatGPT CLI] Output format:', outputFormat);
        
        // Find input field
        let inputField = document.querySelector('#prompt-textarea');
        if (!inputField) {
            inputField = document.querySelector('textarea[placeholder*="Message"]');
        }
        if (!inputField) {
            inputField = document.querySelector('[contenteditable="true"]');
        }
        
        if (!inputField) {
            console.error('[ChatGPT CLI] Input field not found');
            return { text: 'ERROR: input field not found', html: '' };
        }
        
        console.log('[ChatGPT CLI] Input field found, type:', inputField.tagName);
        
        // Clear and set value
        if (inputField.contentEditable === 'true') {
            inputField.textContent = '';
            inputField.innerHTML = message;
        } else {
            inputField.value = message;
        }
        
        // Trigger input events
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));
        
        console.log('[ChatGPT CLI] Message typed, waiting 500ms...');
        await new Promise(r => setTimeout(r, 500));
        
        // Find and click send button
        const sendButton = findSendButton();
        if (!sendButton) {
            console.error('[ChatGPT CLI] Send button not found');
            return { text: 'ERROR: send button not found', html: '' };
        }
        
        console.log('[ChatGPT CLI] Send button found, clicking...');
        sendButton.click();
        console.log('[ChatGPT CLI] Send button clicked');
        
        // Wait for response
        console.log('[ChatGPT CLI] Waiting for response...');
        const response = await waitForChatResponse(outputFormat);
        console.log('[ChatGPT CLI] ===== INJECT END =====');
        
        return response;
    } catch (e) {
        console.error('[ChatGPT CLI] Error in inject:', e);
        return { text: 'ERROR: ' + e.message, html: '' };
    }
}

function findSendButton() {
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

async function waitForChatResponse(outputFormat = 'json', maxWait = 120000) {
    const startTime = Date.now();
    let lastResponseText = '';
    let lastResponseHtml = '';
    let stableCount = 0;
    let pollCount = 0;
    let userPromptArticleFound = false;
    
    console.log('[ChatGPT CLI] ===== RESPONSE POLLING START =====');
    console.log('[ChatGPT CLI] Output format:', outputFormat);
    
    while (Date.now() - startTime < maxWait) {
        pollCount++;
        
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
                // Try to find markdown content div
                let markdownDiv = assistantArticle.querySelector('.markdown');
                if (!markdownDiv) {
                    markdownDiv = assistantArticle.querySelector('[class*="markdown"]');
                }
                
                const text = markdownDiv 
                    ? (markdownDiv.innerText || markdownDiv.textContent || '').trim()
                    : (assistantArticle.innerText || assistantArticle.textContent || '').trim();
                
                const html = outputFormat === 'html' ? assistantArticle.outerHTML : '';
                
                console.log(`[ChatGPT CLI] Assistant text length: ${text.length}, previous: ${lastResponseText.length}`);
                
                // Check if text has changed
                if (text && text !== lastResponseText) {
                    lastResponseText = text;
                    lastResponseHtml = html;
                    stableCount = 0;
                    console.log(`[ChatGPT CLI] Response text changed. New length: ${text.length}`);
                } else if (text === lastResponseText && text.length > 0) {
                    stableCount++;
                    console.log(`[ChatGPT CLI] Response text stable (count: ${stableCount}/5)`);
                    
                    // Need 5 consecutive stable readings (2.5 seconds) to confirm generation complete
                    if (stableCount >= 5) {
                        console.log('[ChatGPT CLI] Response confirmed stable, returning');
                        console.log('[ChatGPT CLI] ===== RESPONSE POLLING END (SUCCESS) =====');
                        return { text: text, html: lastResponseHtml };
                    }
                } else if (text.length === 0) {
                    console.log('[ChatGPT CLI] Assistant article found but has no text yet');
                }
            } else if (userPromptArticleFound) {
                console.log('[ChatGPT CLI] Waiting for assistant article to appear after user prompt...');
            }
        } else {
            console.log('[ChatGPT CLI] No <article> elements found on page');
        }
        
        // Poll every 500ms
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.error('[ChatGPT CLI] Timeout waiting for response after', maxWait, 'ms');
    console.error('[ChatGPT CLI] Last response text length:', lastResponseText.length);
    console.log('[ChatGPT CLI] ===== RESPONSE POLLING END (TIMEOUT) =====');
    return { text: lastResponseText || 'ERROR: timeout waiting for response', html: lastResponseHtml };
}

// Connect when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[ChatGPT CLI] Page loaded, connecting...');
        connectToServer();
    });
} else {
    console.log('[ChatGPT CLI] Page already loaded, connecting...');
    connectToServer();
}


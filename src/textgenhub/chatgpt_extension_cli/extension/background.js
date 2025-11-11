// Background service worker for ChatGPT Automation Extension
console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Background service worker loaded`);

let chatgptTabId = null;
const pendingPromptRegistrations = new Map(); // messageId -> {promptSignature, prompt, tabId, outputFormat, createdAt}
const activeResponseCaptures = new Map(); // requestId -> capture data
const CONVERSATION_ENDPOINTS = [
    'https://chat.openai.com/backend-api/conversation',
    'https://chatgpt.com/backend-api/conversation',
    'https://www.chatgpt.com/backend-api/conversation',
];
const CONVERSATION_URL_PATTERNS = CONVERSATION_ENDPOINTS.map((endpoint) => `${endpoint}*`);

// NEW: Find existing ChatGPT tab
async function findChatGPTTab() {
    const tabs = await chrome.tabs.query({});
    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] DEBUG: All tabs in browser:`);
    tabs.forEach(tab => {
        console.log(`[${new Date().toISOString()}] [ChatGPT CLI]   Tab ${tab.id}: ${tab.url} - "${tab.title}" - active: ${tab.active}`);
    });

    // First, check if there's already an active ChatGPT tab
    for (const tab of tabs) {
        if (tab.active && tab.url && !tab.url.startsWith('chrome://') && (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com') || tab.url.includes('openai.com') || (tab.title && tab.title.includes('ChatGPT')))) {
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Found active ChatGPT tab:`, tab.id, 'URL:', tab.url, 'Title:', tab.title);
            chatgptTabId = tab.id;
            return tab;
        }
    }

    // If no active ChatGPT tab, find the first ChatGPT tab (typically the most recently opened)
    for (const tab of tabs) {
        if (tab.url && !tab.url.startsWith('chrome://') && (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com') || tab.url.includes('openai.com') || (tab.title && tab.title.includes('ChatGPT')))) {
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Found existing ChatGPT tab:`, tab.id, 'URL:', tab.url, 'Title:', tab.title);
            chatgptTabId = tab.id;
            return tab;
        }
    }
    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] No ChatGPT tab found`);
    return null;
}

// NEW: Create ChatGPT tab if it doesn't exist
async function ensureChatGPTTab() {
    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Creating new ChatGPT tab to trigger detection...`);
    let newTab;
    try {
        newTab = await chrome.tabs.create({ url: 'https://chat.openai.com/' });
        console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Created new tab:`, newTab.id);
        chatgptTabId = newTab.id;

        // Wait a moment for tabs to settle
        await new Promise(r => setTimeout(r, 500));

        // Now find existing ChatGPT tabs (excluding the new one we just created)
        const allTabs = await chrome.tabs.query({});
        const existingChatGPTTabs = allTabs.filter(tab =>
            tab.id !== newTab.id &&
            tab.url &&
            !tab.url.startsWith('chrome://') &&
            (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com') || tab.url.includes('openai.com') || (tab.title && tab.title.includes('ChatGPT')))
        );

        if (existingChatGPTTabs.length > 0) {
            // Found existing tab, focus it and close the new one
            const existingTab = existingChatGPTTabs[0]; // Take the first one
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Found existing ChatGPT tab:`, existingTab.id, 'URL:', existingTab.url, 'Title:', existingTab.title);
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Focusing existing tab and closing the new one...`);

            // Focus the existing tab
            await chrome.tabs.update(existingTab.id, { active: true, highlighted: true });
            chatgptTabId = existingTab.id;

            // Close the new tab
            try {
                await chrome.tabs.remove(newTab.id);
                console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Closed unnecessary new tab:`, newTab.id);
            } catch (e) {
                console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Failed to close new tab:`, e.message);
            }

            return existingTab;
        } else {
            // No existing tab found, keep the new one
            console.log(`[${new Date().toISOString()}] [ChatGPT CLI] No existing ChatGPT tab found, keeping the new one`);
            // Wait for tab to fully load (max 10 seconds)
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 500));
                try {
                    const updatedTab = await chrome.tabs.get(newTab.id);
                    if (updatedTab.status === 'complete') {
                        console.log(`[${new Date().toISOString()}] [ChatGPT CLI] ChatGPT tab loaded successfully`);
                        return updatedTab;
                    }
                } catch (e) {
                    console.log(`[${new Date().toISOString()}] [ChatGPT CLI] Tab disappeared during loading:`, e.message);
                    return null;
                }
            }
            console.warn(`[${new Date().toISOString()}] [ChatGPT CLI] ChatGPT tab still loading after 10 seconds`);
            return newTab; // Return anyway, might still work
        }
    } catch (e) {
        console.error(`[${new Date().toISOString()}] [ChatGPT CLI] Failed to create ChatGPT tab:`, e);
        return null;
    }
}

function normalizePrompt(prompt) {
    if (!prompt) {
        return '';
    }
    return prompt.replace(/\s+/g, ' ').trim();
}

function registerPendingPrompt({ messageId, prompt, tabId, outputFormat }) {
    if (!messageId || !prompt) {
        return;
    }

    const now = Date.now();
    for (const [id, entry] of pendingPromptRegistrations.entries()) {
        if (now - entry.createdAt > 5 * 60 * 1000) {
            pendingPromptRegistrations.delete(id);
        }
    }

    const normalized = normalizePrompt(prompt);
    pendingPromptRegistrations.set(messageId, {
        messageId,
        prompt,
        promptSignature: normalized,
        tabId,
        outputFormat: outputFormat || 'json',
        createdAt: now,
    });
    console.log('[ChatGPT CLI] Registered pending prompt for capture', { messageId, length: normalized.length });
}

function findMatchingPrompt(promptFromRequest) {
    const normalized = normalizePrompt(promptFromRequest);
    for (const entry of pendingPromptRegistrations.values()) {
        if (entry.promptSignature === normalized) {
            pendingPromptRegistrations.delete(entry.messageId);
            return entry;
        }
    }
    return null;
}

async function finalizeCapture(capture, reason = 'complete') {
    if (capture.finished) {
        return;
    }
    capture.finished = true;

    if (capture.requestId) {
        activeResponseCaptures.delete(capture.requestId);
    }

    if (!capture.messageId) {
        return;
    }

    const payload = {
        type: 'sse_response',
        messageId: capture.messageId,
        text: capture.responseText || '',
        error: capture.error || null,
        reason,
    };

    if (capture.tabId) {
        try {
            await chrome.tabs.sendMessage(capture.tabId, payload);
        } catch (err) {
            console.log('[ChatGPT CLI] Failed to send SSE response to tab:', err?.message || err);
        }
    }
}

function processSseChunk(capture, chunk) {
    if (!chunk) {
        return;
    }

    capture.buffer += chunk;

    while (true) {
        const separatorIndex = capture.buffer.indexOf('\n\n');
        if (separatorIndex === -1) {
            break;
        }

        const eventBlock = capture.buffer.slice(0, separatorIndex);
        capture.buffer = capture.buffer.slice(separatorIndex + 2);

        const lines = eventBlock.split('\n');
        for (const line of lines) {
            if (!line.startsWith('data:')) {
                continue;
            }

            const payload = line.slice(5).trim();
            if (!payload) {
                continue;
            }

            if (payload === '[DONE]') {
                finalizeCapture(capture, 'done');
                return;
            }

            try {
                const parsed = JSON.parse(payload);
                if (parsed?.error) {
                    capture.error = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
                    finalizeCapture(capture, 'error');
                    return;
                }

                const message = parsed?.message;
                if (message?.author?.role === 'assistant') {
                    const parts = message?.content?.parts;
                    if (Array.isArray(parts) && parts.length > 0) {
                        capture.responseText = parts.join('\n').trim();
                    }
                }
            } catch (err) {
                console.log('[ChatGPT CLI] Failed to parse SSE chunk:', err?.message || err);
            }
        }
    }
}

// NEW: Focus ChatGPT tab
async function focusChatGPTTab() {
    console.log('[ChatGPT CLI] DEBUG: focusChatGPTTab called, current chatgptTabId:', chatgptTabId);

    if (!chatgptTabId) {
        console.log('[ChatGPT CLI] DEBUG: No chatgptTabId, calling ensureChatGPTTab');
        const tab = await ensureChatGPTTab();
        if (!tab) {
            console.log('[ChatGPT CLI] DEBUG: ensureChatGPTTab failed');
            return false;
        }
        console.log('[ChatGPT CLI] DEBUG: ensureChatGPTTab succeeded, tab ID:', tab.id);
    }

    try {
        console.log('[ChatGPT CLI] DEBUG: Attempting to update tab', chatgptTabId, 'to active');
        await chrome.tabs.update(chatgptTabId, {
            active: true,
            highlighted: true
        });
        console.log('[ChatGPT CLI] DEBUG: Tab update successful');

        // Get the updated tab info
        const updatedTab = await chrome.tabs.get(chatgptTabId);
        console.log('[ChatGPT CLI] DEBUG: Updated tab info - active:', updatedTab.active, 'windowId:', updatedTab.windowId);

        // Close duplicate ChatGPT tabs
        console.log('[ChatGPT CLI] DEBUG: Checking for duplicate ChatGPT tabs to close');
        const allTabs = await chrome.tabs.query({});
        const chatgptTabs = allTabs.filter(tab =>
            tab.url &&
            !tab.url.startsWith('chrome://') &&
            (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com') || tab.url.includes('openai.com') || (tab.title && tab.title.includes('ChatGPT')))
        );

        console.log('[ChatGPT CLI] DEBUG: Found', chatgptTabs.length, 'ChatGPT tabs');
        for (const tab of chatgptTabs) {
            if (tab.id !== chatgptTabId) {
                console.log('[ChatGPT CLI] DEBUG: Closing duplicate ChatGPT tab:', tab.id, tab.url);
                try {
                    await chrome.tabs.remove(tab.id);
                    console.log('[ChatGPT CLI] DEBUG: Successfully closed duplicate tab:', tab.id);
                } catch (e) {
                    console.log('[ChatGPT CLI] DEBUG: Failed to close tab:', tab.id, e.message);
                }
            }
        }

        return true;
    } catch (e) {
        console.error('[ChatGPT CLI] DEBUG: Error focusing tab:', e);
        return false;
    }
}

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        try {
            console.log('[ChatGPT CLI] webRequest.onBeforeRequest triggered for URL:', details.url, 'method:', details.method);

            if (details.method !== 'POST') {
                console.log('[ChatGPT CLI] Skipping non-POST request');
                return;
            }

            if (!CONVERSATION_ENDPOINTS.some((endpoint) => details.url.startsWith(endpoint))) {
                console.log('[ChatGPT CLI] URL does not match conversation endpoints');
                return;
            }

            console.log('[ChatGPT CLI] Matched conversation endpoint, checking body');

            const rawBodies = details.requestBody?.raw;
            let requestBodyText = '';
            if (rawBodies && rawBodies.length > 0) {
                const decoder = new TextDecoder('utf-8');
                for (const rawPart of rawBodies) {
                    if (rawPart?.bytes) {
                        requestBodyText += decoder.decode(rawPart.bytes, { stream: true });
                    }
                }
            }

            if (!requestBodyText) {
                console.log('[ChatGPT CLI] No request body found');
                return;
            }

            console.log('[ChatGPT CLI] Request body received, parsing...');

            let promptText = '';
            let conversationId = null;

            try {
                const parsedBody = JSON.parse(requestBodyText);
                conversationId = parsedBody?.conversation_id || null;
                const userMessages = Array.isArray(parsedBody?.messages)
                    ? parsedBody.messages.filter((msg) => msg?.author?.role === 'user')
                    : [];
                if (userMessages.length > 0) {
                    const latestUserMessage = userMessages[userMessages.length - 1];
                    if (latestUserMessage?.content?.parts) {
                        promptText = latestUserMessage.content.parts.join('\n');
                        console.log('[ChatGPT CLI] Extracted prompt text from request body:', promptText.substring(0, 50));
                    }
                }
            } catch (err) {
                console.log('[ChatGPT CLI] Failed to parse request body:', err?.message || err);
                return;
            }

            if (!promptText) {
                console.log('[ChatGPT CLI] No prompt text found in request body');
                return;
            }

            console.log('[ChatGPT CLI] Looking for matching pending prompt...');
            const matchedPrompt = findMatchingPrompt(promptText);
            if (!matchedPrompt) {
                console.log('[ChatGPT CLI] No matching pending prompt found. Registered prompts:', Array.from(pendingPromptRegistrations.keys()));
                return;
            }

            console.log('[ChatGPT CLI] Matched intercepted request to messageId', matchedPrompt.messageId);

            const capture = {
                requestId: details.requestId,
                messageId: matchedPrompt.messageId,
                prompt: matchedPrompt.prompt,
                tabId: matchedPrompt.tabId,
                outputFormat: matchedPrompt.outputFormat,
                conversationId,
                decoder: new TextDecoder('utf-8'),
                buffer: '',
                responseText: '',
                error: null,
                finished: false,
            };

            const filter = chrome.webRequest.filterResponseData(details.requestId);
            activeResponseCaptures.set(details.requestId, capture);

            filter.ondata = (event) => {
                try {
                    const chunkText = capture.decoder.decode(event.data, { stream: true });
                    processSseChunk(capture, chunkText);
                } catch (err) {
                    console.log('[ChatGPT CLI] Error decoding SSE chunk:', err?.message || err);
                }

                try {
                    filter.write(event.data);
                } catch (err) {
                    console.log('[ChatGPT CLI] Failed to forward SSE chunk to page:', err?.message || err);
                }
            };

            filter.onstop = () => {
                try {
                    finalizeCapture(capture, 'stopped');
                } catch (err) {
                    console.log('[ChatGPT CLI] Error finalizing capture on stop:', err?.message || err);
                }

                try {
                    filter.disconnect();
                } catch (err) {
                    console.log('[ChatGPT CLI] Failed to disconnect filter:', err?.message || err);
                }

                activeResponseCaptures.delete(details.requestId);
            };
        } catch (err) {
            console.log('[ChatGPT CLI] Unexpected error in onBeforeRequest listener:', err?.message || err);
        }
    },
    { urls: CONVERSATION_URL_PATTERNS },
    ['blocking', 'requestBody']
);

chrome.runtime.onInstalled.addListener(() => {
    console.log('[ChatGPT CLI] Extension installed.');
});

// Listen for messages from the CLI via the server
let server_connection = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[ChatGPT CLI] Background received:', request.type, 'from sender:', sender);

    if (request.type === 'ping') {
        console.log('[ChatGPT CLI] Handling ping');
        sendResponse({ pong: true });
        return true;
    }

    if (request.type === 'register_prompt') {
        console.log('[ChatGPT CLI] Registering prompt for messageId:', request.messageId);
        registerPendingPrompt({
            messageId: request.messageId,
            prompt: request.prompt,
            tabId: sender?.tab?.id || chatgptTabId,
            outputFormat: request.output_format,
        });
        sendResponse({ success: true });
        return true;
    }

    if (request.type === 'activate_tab') {
        console.log('[ChatGPT CLI] Activating ChatGPT tab');
        (async () => {
            try {
                const success = await focusChatGPTTab();
                sendResponse({ success });
            } catch (e) {
                console.error('[ChatGPT CLI] Error activating tab:', e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (request.type === 'debug_tabs') {
        console.log('[ChatGPT CLI] DEBUG: Handling debug_tabs request');
        (async () => {
            try {
                const tabs = await chrome.tabs.query({});
                console.log('[ChatGPT CLI] DEBUG: All tabs in browser:');
                tabs.forEach(tab => {
                    console.log(`[ChatGPT CLI]   Tab ${tab.id}: ${tab.url} - "${tab.title}" - active: ${tab.active}`);
                });
                const tabData = tabs.map(t => ({
                    id: t.id,
                    url: t.url || '',
                    title: t.title || '',
                    active: t.active || false
                }));
                console.log('[ChatGPT CLI] DEBUG: Sending response with', tabData.length, 'tabs');
                sendResponse({ tab_count: tabs.length, tabs: tabData });
            } catch (e) {
                console.error('[ChatGPT CLI] DEBUG: Error in debug_tabs handler:', e);
                sendResponse({ tab_count: 0, tabs: [], error: e.message });
            }
        })();
        return true;
    }

    if (request.type === 'focus_tab') {
        console.log('[ChatGPT CLI] DEBUG: Received focus_tab request with messageId:', request.messageId);
        (async () => {
            try {
                console.log('[ChatGPT CLI] DEBUG: Calling focusChatGPTTab');
                const success = await focusChatGPTTab();
                console.log('[ChatGPT CLI] DEBUG: focusChatGPTTab returned:', success);
                sendResponse({ success: success });
            } catch (e) {
                console.error('[ChatGPT CLI] DEBUG: Error in focus_tab handler:', e);
                sendResponse({ success: false, error: e.message });
            }
        })();
        return true;
    }

    if (request.type === 'inject') {
        console.log('[ChatGPT CLI] Handling inject request');
        (async () => {
            try {
                const tab = await ensureChatGPTTab();
                if (!tab) {
                    console.error('[ChatGPT CLI] Failed to create/find ChatGPT tab');
                    sendResponse({ error: 'Failed to create ChatGPT tab' });
                    return;
                }

                await focusChatGPTTab();
                await chrome.windows.update(tab.windowId, { focused: true });

                chrome.tabs.sendMessage(tab.id, request, (result) => {
                    sendResponse(result);
                });
            } catch (e) {
                console.error('[ChatGPT CLI] Error in injection handler:', e);
                sendResponse({ error: e.message });
            }
        })();
        return true;
    }

    // Default handler for messages from content scripts to background
    if (sender.tab && sender.tab.id) {
        console.log('[ChatGPT CLI] Forwarding message from tab to content script');
        chrome.tabs.sendMessage(sender.tab.id, request, (result) => {
            sendResponse(result);
        });
        return true;
    }

    console.log('[ChatGPT CLI] No handler found for message type:', request.type);
    return false;
});

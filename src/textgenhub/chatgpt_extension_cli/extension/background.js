// Background service worker for ChatGPT Automation Extension
console.log('[ChatGPT CLI] Background service worker loaded');

let chatgptTabId = null;

// NEW: Find existing ChatGPT tab
async function findChatGPTTab() {
    const tabs = await chrome.tabs.query({});
    console.log('[ChatGPT CLI] DEBUG: All tabs in browser:');
    tabs.forEach(tab => {
        console.log(`[ChatGPT CLI]   Tab ${tab.id}: ${tab.url} - "${tab.title}" - active: ${tab.active}`);
    });

    // First, check if there's already an active ChatGPT tab
    for (const tab of tabs) {
        if (tab.active && tab.url && !tab.url.startsWith('chrome://') && (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com') || tab.url.includes('openai.com') || (tab.title && tab.title.includes('ChatGPT')))) {
            console.log('[ChatGPT CLI] Found active ChatGPT tab:', tab.id, 'URL:', tab.url, 'Title:', tab.title);
            chatgptTabId = tab.id;
            return tab;
        }
    }

    // If no active ChatGPT tab, find the first ChatGPT tab (typically the most recently opened)
    for (const tab of tabs) {
        if (tab.url && !tab.url.startsWith('chrome://') && (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com') || tab.url.includes('openai.com') || (tab.title && tab.title.includes('ChatGPT')))) {
            console.log('[ChatGPT CLI] Found existing ChatGPT tab:', tab.id, 'URL:', tab.url, 'Title:', tab.title);
            chatgptTabId = tab.id;
            return tab;
        }
    }
    console.log('[ChatGPT CLI] No ChatGPT tab found');
    return null;
}

// NEW: Create ChatGPT tab if it doesn't exist
async function ensureChatGPTTab() {
    console.log('[ChatGPT CLI] Creating new ChatGPT tab to trigger detection...');
    let newTab;
    try {
        newTab = await chrome.tabs.create({ url: 'https://chat.openai.com/' });
        console.log('[ChatGPT CLI] Created new tab:', newTab.id);
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
            console.log('[ChatGPT CLI] Found existing ChatGPT tab:', existingTab.id, 'URL:', existingTab.url, 'Title:', existingTab.title);
            console.log('[ChatGPT CLI] Focusing existing tab and closing the new one...');

            // Focus the existing tab
            await chrome.tabs.update(existingTab.id, { active: true, highlighted: true });
            chatgptTabId = existingTab.id;

            // Close the new tab
            try {
                await chrome.tabs.remove(newTab.id);
                console.log('[ChatGPT CLI] Closed unnecessary new tab:', newTab.id);
            } catch (e) {
                console.log('[ChatGPT CLI] Failed to close new tab:', e.message);
            }

            return existingTab;
        } else {
            // No existing tab found, keep the new one
            console.log('[ChatGPT CLI] No existing ChatGPT tab found, keeping the new one');
            // Wait for tab to fully load (max 10 seconds)
            for (let i = 0; i < 20; i++) {
                await new Promise(r => setTimeout(r, 500));
                try {
                    const updatedTab = await chrome.tabs.get(newTab.id);
                    if (updatedTab.status === 'complete') {
                        console.log('[ChatGPT CLI] ChatGPT tab loaded successfully');
                        return updatedTab;
                    }
                } catch (e) {
                    console.log('[ChatGPT CLI] Tab disappeared during loading:', e.message);
                    return null;
                }
            }
            console.warn('[ChatGPT CLI] ChatGPT tab still loading after 10 seconds');
            return newTab; // Return anyway, might still work
        }
    } catch (e) {
        console.error('[ChatGPT CLI] Failed to create ChatGPT tab:', e);
        return null;
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
                // Ensure ChatGPT tab exists and is focused
                const tab = await ensureChatGPTTab();
                if (!tab) {
                    console.error('[ChatGPT CLI] Failed to create/find ChatGPT tab');
                    sendResponse({ error: 'Failed to create ChatGPT tab' });
                    return;
                }

                // CRITICAL: Focus the tab IMMEDIATELY so polling runs at full speed
                await focusChatGPTTab();

                // Keep tab focused during polling (refresh focus every 100ms)
                const focusInterval = setInterval(async () => {
                    try {
                        await chrome.tabs.update(chatgptTabId, { active: true });
                    } catch (e) {
                        console.log('[ChatGPT CLI] Tab focus refresh ended:', e.message);
                        clearInterval(focusInterval);
                    }
                }, 100);

                console.log('[ChatGPT CLI] Started focus maintenance loop');

                // Send injection request to content script
                chrome.tabs.sendMessage(tab.id, request, (result) => {
                    // Stop maintaining focus once we get response
                    clearInterval(focusInterval);
                    console.log('[ChatGPT CLI] Stopped focus maintenance loop');
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

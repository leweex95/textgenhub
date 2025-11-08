// Background service worker for ChatGPT Automation Extension
console.log('[ChatGPT CLI] Background service worker loaded');

let chatgptTabId = null;

// NEW: Find existing ChatGPT tab
async function findChatGPTTab() {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (tab.url && (tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com'))) {
            console.log('[ChatGPT CLI] Found existing ChatGPT tab:', tab.id);
            chatgptTabId = tab.id;
            return tab;
        }
    }
    return null;
}

// NEW: Create ChatGPT tab if it doesn't exist
async function ensureChatGPTTab() {
    let tab = await findChatGPTTab();

    if (!tab) {
        console.log('[ChatGPT CLI] ChatGPT tab not found, creating new one...');
        tab = await chrome.tabs.create({ url: 'https://chatgpt.com/' });
        chatgptTabId = tab.id;

        // Wait for tab to fully load (max 10 seconds)
        for (let i = 0; i < 20; i++) {
            await new Promise(r => setTimeout(r, 500));
            const updatedTab = await chrome.tabs.get(tab.id);
            if (updatedTab.status === 'complete') {
                console.log('[ChatGPT CLI] ChatGPT tab loaded successfully');
                return updatedTab;
            }
        }
        console.warn('[ChatGPT CLI] ChatGPT tab still loading after 10 seconds');
    }

    return tab;
}

// NEW: Focus ChatGPT tab
async function focusChatGPTTab() {
    if (!chatgptTabId) {
        const tab = await ensureChatGPTTab();
        if (!tab) return false;
    }

    try {
        await chrome.tabs.update(chatgptTabId, {
            active: true,
            highlighted: true
        });
        console.log('[ChatGPT CLI] ChatGPT tab focused:', chatgptTabId);
        return true;
    } catch (e) {
        console.error('[ChatGPT CLI] Error focusing tab:', e);
        return false;
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('[ChatGPT CLI] Extension installed.');
});

// Listen for messages from the CLI via the server
let server_connection = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[ChatGPT CLI] Background received:', request.type, 'from tab:', sender.tab?.id);

    if (request.type === 'ping') {
        sendResponse({ pong: true });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (sender.tab && sender.tab.id) {
        chrome.tabs.sendMessage(sender.tab.id, request, async (result) => {
            await postToCliServer(result);
            sendResponse(result);
        });
        return true;
    }
});

// NEW: Handle injection requests with tab management
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'inject') {
        (async () => {
            try {
                // Ensure ChatGPT tab exists and is focused
                const tab = await ensureChatGPTTab();
                if (!tab) {
                    console.error('[ChatGPT CLI] Failed to create/find ChatGPT tab');
                    sendResponse({ error: 'Failed to create ChatGPT tab' });
                    return;
                }

                // Focus the tab
                await focusChatGPTTab();

                // Send injection request to content script
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
});

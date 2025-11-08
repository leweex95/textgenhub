// Background service worker for ChatGPT Automation Extension
console.log('[ChatGPT CLI] Background service worker loaded');

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

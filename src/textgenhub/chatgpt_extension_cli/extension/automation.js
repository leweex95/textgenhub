// ChatGPT automation logic for content script
// Listens for messages from background and automates ChatGPT UI

function sendMessageToChatGPT(message) {
    // Find the input box and send button
    const inputBox = document.querySelector('textarea');
    const sendButton = document.querySelector('button[data-testid="send-button"]');
    if (!inputBox || !sendButton) {
        return { error: 'ChatGPT input or send button not found.' };
    }
    inputBox.value = message;
    inputBox.dispatchEvent(new Event('input', { bubbles: true }));
    sendButton.click();
    return { success: true };
}

function getLatestResponse() {
    // Find the last message from ChatGPT
    const messages = document.querySelectorAll('.markdown');
    if (messages.length === 0) {
        return { error: 'No ChatGPT response found.' };
    }
    return { response: messages[messages.length - 1].innerText };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'send_message') {
        const result = sendMessageToChatGPT(request.message);
        sendResponse(result);
    } else if (request.type === 'get_response') {
        const result = getLatestResponse();
        sendResponse(result);
    }
    return true;
});

console.log('ChatGPT automation logic loaded.');

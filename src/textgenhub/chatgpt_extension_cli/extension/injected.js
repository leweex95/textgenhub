// Injected script to bridge between extension and CLI via WebSocket
(function() {
    console.log('[ChatGPT Automation] Injected script loaded');
    
    let ws = null;
    let connectionAttempts = 0;
    const MAX_ATTEMPTS = 10;
    
    function connectToServer() {
        if (connectionAttempts >= MAX_ATTEMPTS) {
            console.error('[ChatGPT Automation] Max connection attempts reached');
            return;
        }
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('[ChatGPT Automation] Already connected');
            return;
        }
        
        connectionAttempts++;
        console.log(`[ChatGPT Automation] Attempting connection ${connectionAttempts}/${MAX_ATTEMPTS}`);
        
        try {
            ws = new WebSocket('ws://localhost:8765');
            
            ws.onopen = () => {
                console.log('[ChatGPT Automation] WebSocket connected!');
                connectionAttempts = 0;
                // Register as extension
                ws.send(JSON.stringify({ type: 'extension_register' }));
                console.log('[ChatGPT Automation] Registered with server');
            };
            
            ws.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[ChatGPT Automation] Server message:', data.type);
                    
                    if (data.type === 'inject') {
                        console.log('[ChatGPT Automation] Injecting message:', data.message.substring(0, 50));
                        const response = await injectAndWaitForResponse(data.message);
                        ws.send(JSON.stringify({
                            type: 'response',
                            response: response
                        }));
                        console.log('[ChatGPT Automation] Response sent, length:', response.length);
                    }
                } catch (e) {
                    console.error('[ChatGPT Automation] Error handling message:', e);
                }
            };
            
            ws.onerror = (error) => {
                console.error('[ChatGPT Automation] WebSocket error:', error);
            };
            
            ws.onclose = (event) => {
                console.log('[ChatGPT Automation] WebSocket closed, code:', event.code, 'reason:', event.reason);
                ws = null;
                setTimeout(connectToServer, 3000);
            };
        } catch (e) {
            console.error('[ChatGPT Automation] Connection error:', e);
            setTimeout(connectToServer, 3000);
        }
    }
    
    async function injectAndWaitForResponse(message) {
        try {
            console.log('[ChatGPT Automation] Looking for textarea...');
            
            // Find textarea
            const textarea = document.querySelector('textarea');
            if (!textarea) {
                console.error('[ChatGPT Automation] Textarea not found');
                return 'ERROR: textarea not found';
            }
            
            console.log('[ChatGPT Automation] Textarea found, setting value');
            
            // Clear and set message
            textarea.value = message;
            textarea.focus();
            
            // Trigger input events
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
            
            console.log('[ChatGPT Automation] Looking for send button...');
            
            // Wait for send button and click it
            let sendButton = null;
            for (let i = 0; i < 20; i++) {
                sendButton = document.querySelector('button[data-testid="send-button"]');
                if (sendButton && !sendButton.disabled) {
                    console.log('[ChatGPT Automation] Send button found and enabled');
                    break;
                }
                await new Promise(r => setTimeout(r, 100));
            }
            
            if (!sendButton || sendButton.disabled) {
                console.error('[ChatGPT Automation] Send button not found or still disabled');
                return 'ERROR: send button not found';
            }
            
            console.log('[ChatGPT Automation] Clicking send button');
            sendButton.click();
            
            // Wait for ChatGPT response
            return await waitForResponse();
        } catch (e) {
            console.error('[ChatGPT Automation] Error in injectAndWaitForResponse:', e);
            return 'ERROR: ' + e.message;
        }
    }
    
    async function waitForResponse(maxWait = 120000) {
        const startTime = Date.now();
        let lastMessageCount = 0;
        
        console.log('[ChatGPT Automation] Waiting for response...');
        
        while (Date.now() - startTime < maxWait) {
            // Find message containers
            const messageElements = document.querySelectorAll('[role="article"]');
            
            if (messageElements.length > lastMessageCount) {
                lastMessageCount = messageElements.length;
                console.log('[ChatGPT Automation] New messages detected:', lastMessageCount);
                
                // Wait for rendering
                await new Promise(r => setTimeout(r, 2000));
                
                // Get text from last message
                const lastMsg = messageElements[messageElements.length - 1];
                if (lastMsg) {
                    const text = lastMsg.innerText || lastMsg.textContent;
                    if (text && text.trim().length > 0) {
                        console.log('[ChatGPT Automation] Response received, length:', text.length);
                        return text.trim();
                    }
                }
            }
            
            await new Promise(r => setTimeout(r, 500));
        }
        
        console.error('[ChatGPT Automation] Timeout waiting for response');
        return 'ERROR: timeout waiting for response';
    }
    
    // Connect on page load
    console.log('[ChatGPT Automation] Page state:', document.readyState);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('[ChatGPT Automation] DOMContentLoaded event fired');
            connectToServer();
        });
    } else {
        console.log('[ChatGPT Automation] Page already loaded, connecting now');
        connectToServer();
    }
})();

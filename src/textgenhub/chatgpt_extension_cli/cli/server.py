import asyncio
import json
import websockets


extension_ws = None
pending_response = None


async def handler(websocket, path=None):
    global extension_ws, pending_response

    try:
        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get('type')

            print(f"Received: {msg_type}")

            if msg_type == 'extension_register':
                extension_ws = websocket
                print("Extension connected and registered")

            elif msg_type == 'response':
                pending_response = data.get('response')
                print(f"Response received: {pending_response[:100] if pending_response else 'None'}...")

            elif msg_type == 'cli_request':
                if not extension_ws:
                    await websocket.send(json.dumps({'type': 'error', 'message': 'No extension connected'}))
                    continue

                # Forward request to extension with output format
                inject_payload = {
                    'type': 'inject',
                    'message': data.get('message'),
                    'output_format': data.get('output_format', 'json')
                }
                await extension_ws.send(json.dumps(inject_payload))

                # Wait for response from extension
                pending_response = None
                timeout = 120
                elapsed = 0
                while pending_response is None and elapsed < timeout:
                    await asyncio.sleep(0.5)
                    elapsed += 0.5

                # Send response back to CLI
                await websocket.send(json.dumps({
                    'type': 'response',
                    'response': pending_response or 'Timeout waiting for response'
                }))

    except Exception as e:
        print(f"Error: {e}")
    finally:
        if websocket == extension_ws:
            extension_ws = None
            print("Extension disconnected")


async def main():
    async with websockets.serve(handler, "127.0.0.1", 8765):
        print("WebSocket server running on ws://127.0.0.1:8765")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())

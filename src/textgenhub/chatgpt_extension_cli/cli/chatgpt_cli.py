import sys
import argparse
import asyncio
import json
import websockets

async def main():
    parser = argparse.ArgumentParser(description='ChatGPT CLI Automation')
    parser.add_argument('message', type=str, help='Message to send to ChatGPT')
    args = parser.parse_args()

    try:
        async with websockets.connect('ws://localhost:8765') as websocket:
            print(f"Connected to server")
            print(f"Sending: {args.message}")

            # Send request to server to inject message into ChatGPT
            payload = {
                'type': 'cli_request',
                'message': args.message
            }
            await websocket.send(json.dumps(payload))

            # Wait for response
            print("Waiting for ChatGPT response...")
            response = await asyncio.wait_for(websocket.recv(), timeout=120)
            data = json.loads(response)

            if data.get('type') == 'response':
                print("\n=== ChatGPT Response ===")
                print(data.get('response', 'No response'))
                print("=======================\n")
            else:
                print(f"Unexpected response: {data}")

    except asyncio.TimeoutError:
        print("ERROR: Timeout waiting for response from ChatGPT")
        sys.exit(1)
    except ConnectionRefusedError:
        print("ERROR: Could not connect to server on ws://localhost:8765")
        print("Make sure the server is running: poetry run python server.py")
        print("And the extension is loaded in Chrome with ChatGPT open")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())

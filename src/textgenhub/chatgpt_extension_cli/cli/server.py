import asyncio
import json
import websockets
import uuid
import time
from datetime import datetime


extension_ws = None
pending_requests = {}  # Track {messageId: {response, start_time, client_ws, ...}}
client_ws_list = []  # Track all client connections


async def send_message(ws, msg_type, message_id=None, **kwargs):
    """Helper to send structured message"""
    payload = {"type": msg_type, "timestamp": datetime.utcnow().isoformat()}
    if message_id:
        payload["messageId"] = message_id
    payload.update(kwargs)
    await ws.send(json.dumps(payload))


async def send_heartbeat(message_id):
    """Send heartbeat for pending request"""
    if message_id in pending_requests:
        client_ws = pending_requests[message_id].get("client_ws")
        if client_ws:
            try:
                await send_message(client_ws, "heartbeat", message_id)
            except Exception as e:
                print(f"[Server] Error sending heartbeat: {e}")


async def handler(websocket, path=None):
    global extension_ws, pending_requests, client_ws_list

    client_id = str(uuid.uuid4())[:8]
    is_extension = False

    try:
        async for message in websocket:
            data = json.loads(message)
            msg_type = data.get("type")
            message_id = data.get("messageId") or str(uuid.uuid4())

            print(f"[Server] Received [{client_id}] {msg_type} (messageId: {message_id})")

            if msg_type == "extension_register":
                extension_ws = websocket
                is_extension = True
                print(f"[Server] Extension connected: {client_id}")
                await send_message(websocket, "ack", message_id, status="extension_registered")

            elif msg_type == "response":
                # Extension sending response back
                if message_id in pending_requests:
                    pending_requests[message_id]["response"] = data.get("response")
                    pending_requests[message_id]["html"] = data.get("html", "")
                    pending_requests[message_id]["received_at"] = time.time()
                    print(f"[Server] Response received for {message_id}")

            elif msg_type == "cli_request":
                # CLI sending request
                if not extension_ws:
                    print(f"[Server] ERROR: No extension connected for CLI request {message_id}")
                    await send_message(websocket, "error", message_id, error="No extension connected", error_type="extension_not_connected")
                    continue

                # Track the request
                pending_requests[message_id] = {
                    "message": data.get("message"),
                    "output_format": data.get("output_format", "json"),
                    "client_ws": websocket,
                    "start_time": time.time(),
                    "response": None,
                    "html": None,
                    "received_at": None,
                }

                # Send ACK immediately
                print(f"[Server] Sending ACK for {message_id}")
                await send_message(websocket, "ack", message_id, status="request_received")

                # Forward request to extension with message ID
                inject_payload = {"type": "inject", "messageId": message_id, "message": data.get("message"), "output_format": data.get("output_format", "json")}
                await extension_ws.send(json.dumps(inject_payload))
                print(f"[Server] Forwarded injection request {message_id} to extension")

                # Wait for response with heartbeat and timeout
                timeout = 120
                heartbeat_interval = 10
                last_heartbeat = time.time()
                start_time = time.time()

                while message_id in pending_requests:
                    elapsed = time.time() - start_time

                    if elapsed > timeout:
                        print(f"[Server] TIMEOUT for {message_id} after {elapsed:.1f}s")
                        await send_message(websocket, "error", message_id, error=f"Timeout after {timeout}s waiting for response", error_type="response_timeout")
                        del pending_requests[message_id]
                        break

                    # Send heartbeat
                    if time.time() - last_heartbeat >= heartbeat_interval:
                        await send_heartbeat(message_id)
                        last_heartbeat = time.time()

                    # Check if response arrived
                    if pending_requests[message_id]["response"] is not None:
                        response_data = pending_requests[message_id]
                        print(f"[Server] Sending response for {message_id}")
                        await send_message(websocket, "response", message_id, response=response_data["response"], html=response_data["html"])
                        del pending_requests[message_id]
                        break

                    await asyncio.sleep(0.5)

    except Exception as e:
        print(f"[Server] Error: {e}")
    finally:
        if is_extension:
            extension_ws = None
            print(f"[Server] Extension disconnected: {client_id}")
        else:
            if websocket in client_ws_list:
                client_ws_list.remove(websocket)
            print(f"[Server] Client disconnected: {client_id}")


async def main():
    async with websockets.serve(handler, "127.0.0.1", 8765):
        print("[Server] WebSocket server running on ws://127.0.0.1:8765")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())

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
        try:
            async for message in websocket:
                data = json.loads(message)
                msg_type = data.get("type")
                message_id = data.get("messageId") or str(uuid.uuid4())

                print(f"[Server] [{client_id}] Received {msg_type} (ID: {message_id})")

                if msg_type == "extension_register":
                    if extension_ws is not None:
                        print("[Server] WARNING: Extension already connected, replacing")
                    extension_ws = websocket
                    is_extension = True
                    print(f"[Server] Extension registered: {client_id}")
                    await send_message(websocket, "ack", message_id, status="extension_registered")

                elif msg_type == "response":
                    # Extension sending response back
                    print(f"[Server] Extension response for {message_id}: {data.get('response', '')[:30]}")
                    if message_id in pending_requests:
                        pending_requests[message_id]["response"] = data.get("response")
                        pending_requests[message_id]["html"] = data.get("html", "")
                        pending_requests[message_id]["received_at"] = time.time()
                        print(f"[Server] Response stored for {message_id}, notifying client")
                    else:
                        print(f"[Server] ERROR: No pending request for {message_id}")

                elif msg_type == "cli_request":
                    # CLI sending request
                    print(f"[Server] CLI request received. Extension status: {extension_ws}")
                    if not extension_ws:
                        print(f"[Server] ERROR: No extension connected for CLI request {message_id}")
                        print(f"[Server] Available connections: {len(client_ws_list)} clients")
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
                    try:
                        await extension_ws.send(json.dumps(inject_payload))
                        print(f"[Server] Forwarded injection request {message_id} to extension")
                    except Exception as e:
                        print(f"[Server] ERROR forwarding to extension: {e}")
                        await send_message(websocket, "error", message_id, error=f"Failed to forward to extension: {e}", error_type="injection_failed")
                        continue

                    # Wait for response with heartbeat and timeout
                    # Use a very long timeout (300s) since the CLI client sets its own timeout
                    # We never want the server to timeout before the client does
                    timeout = 300
                    heartbeat_interval = 10
                    last_heartbeat = time.time()
                    start_time = time.time()

                    print(f"[Server] Entering wait loop for {message_id}")

                    while True:
                        try:
                            # Check if request was deleted (shouldn't happen in normal flow)
                            if message_id not in pending_requests:
                                print(f"[Server] Request {message_id} was removed")
                                break

                            elapsed = time.time() - start_time

                            if elapsed > timeout:
                                print(f"[Server] TIMEOUT for {message_id} after {elapsed:.1f}s")
                                if message_id in pending_requests:
                                    await send_message(websocket, "error", message_id, error=f"Timeout after {timeout}s waiting for response", error_type="response_timeout")
                                    del pending_requests[message_id]
                                break

                            # Send heartbeat every 10s
                            if time.time() - last_heartbeat >= heartbeat_interval:
                                await send_heartbeat(message_id)
                                last_heartbeat = time.time()

                            # Check if response arrived
                            if message_id in pending_requests and pending_requests[message_id]["response"] is not None:
                                response_data = pending_requests[message_id]
                                response_preview = response_data["response"][:50] if len(response_data["response"]) > 50 else response_data["response"]
                                print(f"[Server] Sending response for {message_id}: {response_preview}")
                                await send_message(websocket, "response", message_id, response=response_data["response"], html=response_data["html"])
                                if message_id in pending_requests:
                                    del pending_requests[message_id]
                                break

                            await asyncio.sleep(0.1)  # Check every 100ms
                        except Exception as e:
                            print(f"[Server] Error in response loop for {message_id}: {e}")
                            if message_id in pending_requests:
                                del pending_requests[message_id]
                            break
        except Exception as inner_e:
            print(f"[Server] Handler inner error: {inner_e}")
            import traceback

            traceback.print_exc()

    except Exception as e:
        print(f"[Server] Handler outer error: {e}")
        import traceback

        traceback.print_exc()
    finally:
        if is_extension:
            extension_ws = None
            print(f"[Server] Extension disconnected: {client_id}")
        else:
            if websocket in client_ws_list:
                client_ws_list.remove(websocket)
            print(f"[Server] Client disconnected: {client_id}")


async def main():
    await websockets.serve(handler, "127.0.0.1", 8765)
    print("[Server] WebSocket server running on ws://127.0.0.1:8765")

    # Keep server running indefinitely
    while True:
        await asyncio.sleep(1)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[Server] Stopped by user")

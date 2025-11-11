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
    
    # Limit concurrent non-extension connections
    if len(client_ws_list) > 50:
        print(f"[Server] WARNING: Too many client connections ({len(client_ws_list)}), rejecting new connection")
        await websocket.close(1008, "Server at capacity")
        return

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get("type")
                message_id = data.get("messageId") or str(uuid.uuid4())

                print(f"[Server] [{client_id}] Received {msg_type} (ID: {message_id})")

                if msg_type == "extension_register":
                    if extension_ws is not None:
                        print("[Server] WARNING: Extension already connected, replacing")
                        try:
                            await extension_ws.close()
                        except:
                            pass
                    extension_ws = websocket
                    is_extension = True
                    print(f"[Server] Extension registered: {client_id}")
                    await send_message(websocket, "ack", message_id, status="extension_registered")
                    print(f"[Server] ACK sent, continuing to listen for messages from extension...")
                    # Continue loop - DO NOT close or break

                elif msg_type == "response":
                    # Extension sending response back
                    print(f"[Server] DEBUG: Extension response for {message_id}")
                    if message_id in pending_requests:
                        request_type = pending_requests[message_id].get("type", "inject")
                        print(f"[Server] DEBUG: Processing {request_type} response for {message_id}")
                        if request_type == "focus_tab":
                            pending_requests[message_id]["success"] = data.get("success", False)
                            pending_requests[message_id]["error"] = data.get("error")
                        elif request_type == "debug_tabs":
                            pending_requests[message_id]["tabs"] = data.get("tabs", [])
                            pending_requests[message_id]["tab_count"] = data.get("tab_count", 0)
                        else:
                            pending_requests[message_id]["response"] = data.get("response")
                            pending_requests[message_id]["html"] = data.get("html", "")
                        pending_requests[message_id]["received_at"] = time.time()
                        print(f"[Server] DEBUG: Response stored for {message_id}")
                    else:
                        print(f"[Server] ERROR: No pending request for {message_id}")

                elif msg_type == "cli_request":
                    # CLI sending request
                    print(f"[Server] CLI request received. Extension status: {extension_ws}")
                    if not extension_ws:
                        print(f"[Server] ERROR: No extension connected")
                        await send_message(websocket, "error", message_id, error="No extension connected")
                        continue

                    request_type = data.get("request_type", "inject")
                    pending_requests[message_id] = {
                        "type": request_type,
                        "message": data.get("message"),
                        "output_format": data.get("output_format", "json"),
                        "client_ws": websocket,
                        "start_time": time.time(),
                        "response": None,
                        "html": None,
                        "received_at": None,
                    }

                    await send_message(websocket, "ack", message_id, status="request_received")
                    
                    # Forward to extension
                    if request_type == "inject":
                        payload = {"type": "inject", "messageId": message_id, "message": data.get("message"), "output_format": data.get("output_format", "json")}
                        try:
                            await extension_ws.send(json.dumps(payload))
                            print(f"[Server] Forwarded injection to extension")
                        except Exception as e:
                            print(f"[Server] ERROR forwarding: {e}")
                            await send_message(websocket, "error", message_id, error=f"Forward failed: {e}")
                            continue

                    # Wait for response
                    timeout = 300
                    heartbeat_interval = 10
                    last_heartbeat = time.time()
                    start_time = time.time()

                    while True:
                        elapsed = time.time() - start_time
                        if elapsed > timeout:
                            print(f"[Server] TIMEOUT for {message_id}")
                            if message_id in pending_requests:
                                del pending_requests[message_id]
                            await send_message(websocket, "error", message_id, error=f"Timeout after {timeout}s")
                            break

                        if time.time() - last_heartbeat >= heartbeat_interval:
                            await send_heartbeat(message_id)
                            last_heartbeat = time.time()

                        if message_id in pending_requests:
                            if pending_requests[message_id].get("response") is not None:
                                resp = pending_requests[message_id]["response"]
                                html = pending_requests[message_id].get("html", "")
                                print(f"[Server] Sending response for {message_id}: {len(resp)} chars")
                                await send_message(websocket, "response", message_id, response=resp, html=html)
                                del pending_requests[message_id]
                                break

                        await asyncio.sleep(0.1)

            except Exception as e:
                print(f"[Server] Error processing message: {e}")
                import traceback
                traceback.print_exc()
                # Continue loop, don't break on error

    except Exception as e:
        print(f"[Server] Handler error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if is_extension:
            extension_ws = None
            print(f"[Server] Extension disconnected")
        else:
            if websocket in client_ws_list:
                client_ws_list.remove(websocket)
            print(f"[Server] Client disconnected")


async def main():
    print("[Server] Starting on port 8765...")
    async with websockets.serve(handler, "127.0.0.1", 8765):
        print("[Server] Listening...")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())

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
                    print(f"[Server] DEBUG: Extension WebSocket connection established")
                    await send_message(websocket, "ack", message_id, status="extension_registered")

                elif msg_type == "response":
                    # Extension sending response back
                    print(f"[Server] DEBUG: Extension response for {message_id}: success={data.get('success')}, error={data.get('error')}")
                    if message_id in pending_requests:
                        request_type = pending_requests[message_id].get("type", "inject")
                        print(f"[Server] DEBUG: Processing {request_type} response for {message_id}")
                        if request_type == "focus_tab":
                            # For focus_tab responses, store success/error
                            pending_requests[message_id]["success"] = data.get("success", False)
                            pending_requests[message_id]["error"] = data.get("error")
                        elif request_type == "debug_tabs":
                            # For debug_tabs responses, store tabs info
                            pending_requests[message_id]["tabs"] = data.get("tabs", [])
                            pending_requests[message_id]["tab_count"] = data.get("tab_count", 0)
                        else:
                            # For inject responses, store response/html
                            pending_requests[message_id]["response"] = data.get("response")
                            pending_requests[message_id]["html"] = data.get("html", "")
                        pending_requests[message_id]["received_at"] = time.time()
                        print(f"[Server] DEBUG: Response stored for {message_id}, notifying client")
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

                    # Send ACK immediately
                    print(f"[Server] Sending ACK for {request_type} request {message_id}")
                    await send_message(websocket, "ack", message_id, status="request_received")

                    # Forward request to extension based on type
                    if request_type == "inject":
                        inject_payload = {"type": "inject", "messageId": message_id, "message": data.get("message"), "output_format": data.get("output_format", "json")}
                        try:
                            await extension_ws.send(json.dumps(inject_payload))
                            print(f"[Server] Forwarded injection request {message_id} to extension")
                        except Exception as e:
                            print(f"[Server] ERROR forwarding to extension: {e}")
                            await send_message(websocket, "error", message_id, error=f"Failed to forward to extension: {e}", error_type="injection_failed")
                            continue
                    elif request_type in ["focus_tab", "debug_tabs"]:
                        # Forward focus_tab or debug_tabs request directly
                        payload = {"type": request_type, "messageId": message_id}
                        try:
                            await extension_ws.send(json.dumps(payload))
                            print(f"[Server] Forwarded {request_type} request {message_id} to extension")
                        except Exception as e:
                            print(f"[Server] ERROR forwarding {request_type} request: {e}")
                            await send_message(websocket, "error", message_id, error=f"Failed to forward to extension: {e}", error_type=f"{request_type}_failed")
                            continue
                    else:
                        print(f"[Server] ERROR: Unknown request type: {request_type}")
                        await send_message(websocket, "error", message_id, error=f"Unknown request type: {request_type}")
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
                            if message_id in pending_requests:
                                request_data = pending_requests[message_id]
                                request_type = request_data.get("type", "inject")

                                if request_type == "focus_tab":
                                    # For focus_tab, check if success is set
                                    if request_data.get("success") is not None:
                                        print(f"[Server] Sending focus_tab response for {message_id}: success={request_data['success']}")
                                        await send_message(websocket, "response", message_id, success=request_data["success"], error=request_data.get("error"))
                                        del pending_requests[message_id]
                                        break
                                elif request_type == "debug_tabs":
                                    # For debug_tabs, check if tabs info is set
                                    if request_data.get("tabs") is not None:
                                        print(f"[Server] Sending debug_tabs response for {message_id}: {request_data['tab_count']} tabs")
                                        await send_message(websocket, "response", message_id, tabs=request_data["tabs"], tab_count=request_data["tab_count"])
                                        del pending_requests[message_id]
                                        break
                                else:
                                    # For inject, check if response is set
                                    if request_data.get("response") is not None:
                                        response_preview = request_data["response"][:50] if len(request_data["response"]) > 50 else request_data["response"]
                                        print(f"[Server] Sending inject response for {message_id}: {response_preview}")
                                        await send_message(websocket, "response", message_id, response=request_data["response"], html=request_data.get("html"))
                                        del pending_requests[message_id]
                                        break

                            await asyncio.sleep(0.1)  # Check every 100ms
                        except Exception as e:
                            print(f"[Server] Error in response loop for {message_id}: {e}")
                            if message_id in pending_requests:
                                del pending_requests[message_id]
                            break

                elif msg_type == "focus_tab":
                    # CLI requesting to focus ChatGPT tab
                    print(f"[Server] DEBUG: Focus tab request received. Extension status: {extension_ws}")
                    if not extension_ws:
                        print(f"[Server] ERROR: No extension connected for focus_tab request {message_id}")
                        await send_message(websocket, "error", message_id, error="No extension connected", error_type="extension_not_connected")
                        continue

                    # Track the request
                    pending_requests[message_id] = {
                        "type": "focus_tab",
                        "client_ws": websocket,
                        "start_time": time.time(),
                        "success": None,
                        "error": None,
                        "received_at": None,
                    }

                    # Send ACK immediately
                    print(f"[Server] DEBUG: Sending ACK for focus_tab {message_id}")
                    await send_message(websocket, "ack", message_id, status="request_received")

                    # Forward focus_tab request to extension
                    focus_payload = {"type": "focus_tab", "messageId": message_id}
                    print(f"[Server] DEBUG: Forwarding focus_tab request {message_id} to extension")
                    try:
                        await extension_ws.send(json.dumps(focus_payload))
                        print(f"[Server] DEBUG: Successfully forwarded focus_tab request {message_id} to extension")
                    except Exception as e:
                        print(f"[Server] ERROR forwarding focus_tab to extension: {e}")
                        await send_message(websocket, "error", message_id, error=f"Failed to forward to extension: {e}", error_type="focus_failed")
                        continue

                    # Wait for response from extension
                    timeout = 30  # 30 second timeout for tab focusing
                    start_time = time.time()

                    print(f"[Server] DEBUG: Waiting for focus_tab response for {message_id}")
                    while True:
                        elapsed = time.time() - start_time
                        if elapsed > timeout:
                            print(f"[Server] TIMEOUT for focus_tab {message_id} after {elapsed:.1f}s")
                            await send_message(websocket, "error", message_id, error=f"Timeout after {timeout}s waiting for focus response", error_type="focus_timeout")
                            break

                        # Check if we got a response (this would come as a 'response' message from extension)
                        # For focus_tab, we expect a simple success/failure response
                        await asyncio.sleep(0.1)

                elif msg_type == "debug_tabs":
                    # CLI requesting debug info about tabs
                    print(f"[Server] DEBUG: Debug tabs request received. Extension status: {extension_ws}")
                    if not extension_ws:
                        print(f"[Server] ERROR: No extension connected for debug_tabs request {message_id}")
                        await send_message(websocket, "error", message_id, error="No extension connected", error_type="extension_not_connected")
                        continue

                    # Track the request
                    pending_requests[message_id] = {
                        "type": "debug_tabs",
                        "client_ws": websocket,
                        "start_time": time.time(),
                        "tabs": None,
                        "tab_count": None,
                        "received_at": None,
                    }

                    # Send ACK immediately
                    print(f"[Server] DEBUG: Sending ACK for debug_tabs {message_id}")
                    await send_message(websocket, "ack", message_id, status="request_received")

                    # Forward debug_tabs request to extension
                    debug_payload = {"type": "debug_tabs", "messageId": message_id}
                    print(f"[Server] DEBUG: Forwarding debug_tabs request {message_id} to extension")
                    try:
                        await extension_ws.send(json.dumps(debug_payload))
                        print(f"[Server] DEBUG: Successfully forwarded debug_tabs request {message_id} to extension")
                    except Exception as e:
                        print(f"[Server] ERROR forwarding debug_tabs to extension: {e}")
                        await send_message(websocket, "error", message_id, error=f"Failed to forward to extension: {e}", error_type="debug_failed")
                        continue

                    # Wait for response from extension
                    timeout = 10  # 10 second timeout for debug
                    start_time = time.time()

                    print(f"[Server] DEBUG: Waiting for debug_tabs response for {message_id}")
                    while True:
                        elapsed = time.time() - start_time
                        if elapsed > timeout:
                            print(f"[Server] TIMEOUT for debug_tabs {message_id} after {elapsed:.1f}s")
                            await send_message(websocket, "error", message_id, error=f"Timeout after {timeout}s waiting for debug response", error_type="debug_timeout")
                            break

                        # Check if we got a response
                        if message_id in pending_requests and pending_requests[message_id].get("tabs") is not None:
                            response_data = pending_requests[message_id]
                            print(f"[Server] Sending debug_tabs response for {message_id}: {response_data['tab_count']} tabs")
                            await send_message(websocket, "response", message_id, tabs=response_data["tabs"], tab_count=response_data["tab_count"])
                            del pending_requests[message_id]
                            break

                        await asyncio.sleep(0.1)
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
            print(f"[Server] DEBUG: Extension WebSocket connection lost")
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

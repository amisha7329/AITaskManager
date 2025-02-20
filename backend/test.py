from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

  
connected_clients = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Handles WebSocket connections."""
    await websocket.accept()
    connected_clients.append(websocket)
    print("🔗 Client connected")

    try:
        while True:
            message = await websocket.receive_text() 
            print(f"Received: {message}")

            response_message = f"Server says: {message.upper()}"
            await websocket.send_text(response_message) 
            print(f"Sent: {response_message}")

    except Exception as e:
        print(f"Connection closed: {e}")
    finally:
        connected_clients.remove(websocket)
        print("Client disconnected")


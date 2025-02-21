from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi_socketio import SocketManager
from starlette.middleware.sessions import SessionMiddleware
from starlette.requests import Request
from authlib.integrations.starlette_client import OAuth
from sqlalchemy.orm import Session
import os
import jwt
import uuid
from dotenv import load_dotenv
from database import SessionLocal
from models import User, Task
import openai
import google.generativeai as genai
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.responses import JSONResponse
import urllib.parse
import json

load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
# print("OpenAI API Key:", os.getenv("OPENAI_API_KEY"))

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
print("GEMINI API Key:", os.getenv("GEMINI_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY"),
    session_cookie="session",
    same_site="lax",
    https_only=os.getenv("ENV") == "production"
)

@app.middleware("http")
async def add_headers(request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    return response

# sio = SocketManager(app=app, mount_location="/socket.io", cors_allowed_origins=["*"], async_mode="asgi")
sio = SocketManager(app=app, mount_location="/socket.io", cors_allowed_origins=["*"], async_mode="asgi")

active_connections = set()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



oauth = OAuth()
oauth.register(
    name="google",
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


def create_jwt(user_id: str):
    return jwt.encode({"user_id": user_id}, os.getenv("SECRET_KEY"), algorithm="HS256")

# decoding JWT Token
def get_current_user(token: str, db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
        user = db.query(User).filter(User.id == payload["user_id"]).first()
        if not user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
    
def generate_task_tagsOAI(title: str, description: str):
    prompt = f"Classify this task into one category: Work, Urgent, Personal, Shopping, Travel, Health, Learning, Finance, Others.\n\nTask Title: {title}\nTask Description: {description}\nCategory:"

    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "system", "content": prompt}],
            temperature=0.5
        )
        return response.choices[0].message.content.strip()

    except openai.RateLimitError:
        print("⚠ OpenAI API quota exceeded! Returning default tag.")
        return "Others"

    except Exception as e:
        print(f"⚠ OpenAI API Error: {e}")
        return "Unknown"
    
def generate_task_tagsGAI(title: str, description: str) -> str:
    """
    Uses Google Gemini AI to generate a single-word task tag based on task title and description.
    Returns only the first relevant tag as a string.
    """
    try:
        prompt = f"Generate ONE single-word category for this task from the following: Work, Urgent, Personal, Shopping, Travel, Health, Learning, Finance, Others.\n\nTitle: {title}\nDescription: {description}\nCategory:"

        model = genai.GenerativeModel("gemini-pro")
        response = model.generate_content(prompt)

        print("Gemini AI response:", response.text)

        tags = response.text.strip().split(",") 
        selected_tag = tags[0].strip() if tags else "Others"

        return selected_tag

    except Exception as e:
        print(f"⚠ Gemini API Error: {e}")
        return "Others"
    
    
@app.get("/")
async def home():
    return {"message": "Welcome to TaskManager-AI"}

@app.get("/auth/login")
async def login(request: Request):
    request.session.clear()
    return await oauth.google.authorize_redirect(
        request,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI", "http://ami.polotrax.com/auth/callback"),
        prompt="select_account",
    )

@app.get("/auth/callback")
async def auth_callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
        user_info = await oauth.google.get("https://www.googleapis.com/oauth2/v3/userinfo", token=token)
        user_data = user_info.json()

        user = db.query(User).filter(User.email == user_data["email"]).first()

        if not user:
            new_user = User(
                id=user_data["sub"],
                name=user_data["name"],
                email=user_data["email"],
                picture=user_data["picture"],
            )
            db.add(new_user)
            db.commit()
            db.refresh(new_user)
            user = new_user

        jwt_token = create_jwt(user.id)

        user_info_encoded = urllib.parse.quote(json.dumps({
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "picture": user.picture
        }))

        frontend_url = f"http://localhost:5173/dashboard?token={jwt_token}&user={user_info_encoded}"
        return RedirectResponse(url=frontend_url)

    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=400)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Handles WebSocket connections for task management."""
    await websocket.accept()
    active_connections.add(websocket)
    print(f"🔗 Client connected: {websocket.client}")

    try:
        while True:
            # Receive the message from the client
            data = await websocket.receive_text()
            print(f"Received WebSocket message: {data}")

            message = json.loads(data)
            action = message.get("action")
            token = message.get("token")
            
            if not token:
                print("⚠ No token received. Closing connection.")
                await websocket.send_text(json.dumps({"error": "No token provided"}))
                await websocket.close()
                return
            
            db = SessionLocal()
            user = get_current_user(token, db)

            # fetch tasks
            if action == "get_tasks":
                tasks = db.query(Task).filter(Task.owner_id == user.id).all()
                tasks_list = [
                    {
                        "id": task.id,
                        "title": task.title,
                        "description": task.description,
                        "completed": task.completed,
                        "tags": task.tags
                    }
                    for task in tasks
                ]
                print(f"Sending task list: {tasks_list}")
                await websocket.send_text(json.dumps({"event": "task_list", "tasks": tasks_list}))

            elif action == "add_task":
                task = message.get("task")
                # generate tag via Gemini AI
                print("Generating task tag with Gemini AI...")
                selected_tag = generate_task_tagsGAI(task["title"], task["description"])
                print(f"Selected Tag: {selected_tag}")
                task_obj = Task(
                    id=str(uuid.uuid4()),
                    title=task["title"],
                    description=task["description"],
                    completed=False,
                    owner_id=user.id,
                    tags=selected_tag
                )
                db.add(task_obj)
                db.commit()
                db.refresh(task_obj)

                task_data = {
                    "id": task_obj.id,
                    "title": task_obj.title,
                    "description": task_obj.description,
                    "completed": task_obj.completed,
                    "owner_id": task_obj.owner_id,
                    "tags": task_obj.tags
                }

                print(f"Broadcasting new task: {task_data}")
                await broadcast_message({"event": "task_created", "task": task_data})

            elif action == "delete_task":
                task_id = message.get("task_id")
                task = db.query(Task).filter(Task.id == task_id, Task.owner_id == user.id).first()

                if task:
                    db.delete(task)
                    db.commit()
                    print(f"Broadcasting task deleted: {task_id}")
                    await broadcast_message({"event": "task_deleted", "task_id": task_id})
                else:
                    print(f"⚠ Task {task_id} not found")
                    await websocket.send_text(json.dumps({"error": "Task not found"}))

            db.close()

    except WebSocketDisconnect:
        active_connections.remove(websocket)
        print(f"Client disconnected: {websocket.client}")


async def broadcast_message(message: dict):
    """Sends a message to all connected WebSocket clients."""
    print(f"Broadcasting message to {len(active_connections)} clients: {message}")
    disconnected_clients = []
    for connection in active_connections:
        try:
            await connection.send_text(json.dumps(message))
        except:
            disconnected_clients.append(connection)
    
    for connection in disconnected_clients:
        active_connections.remove(connection)

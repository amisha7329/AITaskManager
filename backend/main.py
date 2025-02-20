from fastapi import FastAPI, Depends, HTTPException
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
from pydantic import BaseModel
from fastapi import Response
from fastapi import Body
import google.auth.transport.requests
from google.oauth2 import id_token

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
sio = SocketManager(app=app, mount_location="/socket.io", cors_allowed_origins=["http://localhost:5173"], async_mode="asgi")


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
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI", "http://127.0.0.1:8000/auth/callback"),
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



@app.get("/auth/logout")
async def logout(request: Request):
    request.session.clear()
    return {"message": "Logged out successfully"}

# Task CRUD APIs with Real-Time Events

class TaskCreate(BaseModel):
    title: str
    description: str


@app.post("/tasks/")
async def create_task(task: TaskCreate, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)

    print("Generating task tag with Gemini AI...")
    selected_tag = generate_task_tagsGAI(task.title, task.description)
    print(f"Selected Tag: {selected_tag}")

    task_obj = Task(
        id=str(uuid.uuid4()),
        title=task.title,
        description=task.description,
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
    
    await sio.emit("task_created", {"task": task_data})

    return {"task": task_data}



@app.get("/tasks/")
async def get_tasks(token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    tasks = db.query(Task).filter(Task.owner_id == user.id).all()
    return {"tasks": tasks}

class TaskUpdate(BaseModel):
    title: str
    description: str
    completed: bool

@app.put("/tasks/{task_id}")
async def update_task(task_id: str, task_update: TaskUpdate, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    task = db.query(Task).filter(Task.id == task_id, Task.owner_id == user.id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.title = task_update.title
    task.description = task_update.description
    task.completed = task_update.completed
    db.commit()
    db.refresh(task)

    await sio.emit("task_updated", {"task": {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "completed": task.completed
    }})

    return {"task": task}


@app.delete("/tasks/{task_id}")
async def delete_task(task_id: str, token: str, db: Session = Depends(get_db)):
    user = get_current_user(token, db)
    task = db.query(Task).filter(Task.id == task_id, Task.owner_id == user.id).first()

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    db.delete(task)
    db.commit()

    await sio.emit("task_deleted", {"task_id": task_id})

    return {"message": "Task deleted successfully"}


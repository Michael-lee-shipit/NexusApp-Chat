import base64
import binascii
import json
import math
import os
import re
import secrets
from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr, Field, AliasChoices, field_validator, model_validator
from dotenv import load_dotenv
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from typing import Any, Dict, List, Protocol, cast
from pathlib import Path
from authlib.integrations.starlette_client import OAuth
from starlette.middleware.sessions import SessionMiddleware

load_dotenv(Path(__file__).with_name(".env"))

from .database import engine, Base, get_db, migrate_users_schema
from .models import User, Room, Message

Base.metadata.create_all(bind=engine)
migrate_users_schema()

app = FastAPI(title="NexusApp API", version="1.0")
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", secrets.token_urlsafe(32)),
    same_site="lax",
    https_only=os.getenv("COOKIE_HTTPS_ONLY", "false").lower() == "true",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "FRONTEND_ORIGINS",
            "null,http://localhost:3000,http://127.0.0.1:3000,"
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:5500,http://127.0.0.1:5500,"
            "http://localhost:5501,http://127.0.0.1:5501,"
            "http://localhost:8000,http://127.0.0.1:8000",
        ).split(",")
        if origin.strip()
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class OAuthResponse(Protocol):
    def json(self) -> Any: ...


class OAuthClient(Protocol):
    async def authorize_redirect(self, request: Request, redirect_uri: Any) -> Any: ...

    async def authorize_access_token(self, request: Request) -> dict[str, Any]: ...

    async def get(self, url: str, **kwargs: Any) -> OAuthResponse: ...


class OAuthRegistry(Protocol):
    def register(
        self,
        *,
        name: str,
        client_id: str,
        client_secret: str,
        **kwargs: Any,
    ) -> object: ...

    def create_client(self, name: str) -> OAuthClient | None: ...


oauth = cast(OAuthRegistry, OAuth())
OAUTH_SETTINGS = {
    "google": ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"),
    "github": ("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"),
    "x": ("X_CLIENT_ID", "X_CLIENT_SECRET"),
}

if os.getenv("GOOGLE_CLIENT_ID") and os.getenv("GOOGLE_CLIENT_SECRET"):
    oauth.register(
        name="google",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )

if os.getenv("GITHUB_CLIENT_ID") and os.getenv("GITHUB_CLIENT_SECRET"):
    oauth.register(
        name="github",
        client_id=os.environ["GITHUB_CLIENT_ID"],
        client_secret=os.environ["GITHUB_CLIENT_SECRET"],
        authorize_url="https://github.com/login/oauth/authorize",
        access_token_url="https://github.com/login/oauth/access_token",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "read:user user:email"},
    )

if os.getenv("X_CLIENT_ID"):
    oauth.register(
        name="x",
        client_id=os.environ["X_CLIENT_ID"],
        client_secret=os.getenv("X_CLIENT_SECRET", ""),
        authorize_url="https://twitter.com/i/oauth2/authorize",
        access_token_url="https://api.twitter.com/2/oauth2/token",
        api_base_url="https://api.x.com/2/",
        client_kwargs={
            "scope": "users.read tweet.read",
            "code_challenge_method": "S256",
        },
    )

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_.-]+$")
    email: EmailStr
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)

    @field_validator("username", mode="before")
    @classmethod
    def clean_username(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return str(value).strip().lower()

    @field_validator("password", "confirm_password")
    @classmethod
    def bcrypt_password_length(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or fewer")
        return value

    @model_validator(mode="after")
    def passwords_must_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

class UserLogin(BaseModel):
    identifier: str = Field(validation_alias=AliasChoices("identifier", "username", "email"))
    password: str

class RoomCreate(BaseModel):
    name: str

class RoomArchiveUpdate(BaseModel):
    is_archived: bool

@app.post("/api/signup", status_code=status.HTTP_201_CREATED)
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    existing_username = db.query(User).filter(
        func.lower(User.username) == user_data.username.lower()
    ).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username is already taken")
    existing_email = db.query(User).filter(
        func.lower(User.email) == user_data.email
    ).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered")

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username or email is already registered")
    db.refresh(new_user)
    return {
        "message": "User created successfully",
        "user_id": new_user.id,
        "username": new_user.username,
    }

@app.post("/api/login")
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    identifier = user_data.identifier.strip()
    user = db.query(User).filter(
        (func.lower(User.username) == identifier.lower())
        | (func.lower(User.email) == identifier.lower())
    ).first()
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid username/email or password")
    
    return {"message": "Login successful", "user_id": user.id, "username": user.username}


@app.get("/api/auth/providers")
def auth_providers():
    return {
        "providers": [
            provider for provider in OAUTH_SETTINGS
            if oauth.create_client(provider) is not None
        ]
    }


@app.get("/auth/{provider}/login", name="oauth_login")
async def oauth_login(provider: str, request: Request):
    if provider not in OAUTH_SETTINGS:
        raise HTTPException(status_code=404, detail="Unknown identity provider")
    client = oauth.create_client(provider)
    if client is None:
        client_id_env, client_secret_env = OAUTH_SETTINGS[provider]
        required_env = client_id_env if provider == "x" else f"{client_id_env} and {client_secret_env}"
        raise HTTPException(
            status_code=503,
            detail=f"Social sign-in is not configured. Set {required_env} in the backend environment.",
        )
    redirect_uri = request.url_for("oauth_callback", provider=provider)
    return await client.authorize_redirect(request, redirect_uri)


def oauth_result_page(user_id: int, username: str):
    user_json = json.dumps({"user_id": user_id, "username": username}).replace("<", "\\u003c")
    return HTMLResponse(
        "<!doctype html><html><head><meta charset='utf-8'><title>NexusApp</title></head>"
        "<body><p>Sign-in complete. You can close this window.</p><script>"
        f"if (window.opener) {{ window.opener.postMessage({{type:'zenith-auth-success',user:{user_json}}}, '*'); window.close(); }}"
        "</script></body></html>"
    )


@app.get("/auth/{provider}/callback", name="oauth_callback")
async def oauth_callback(provider: str, request: Request, db: Session = Depends(get_db)):
    if provider not in OAUTH_SETTINGS:
        raise HTTPException(status_code=404, detail="Unknown identity provider")
    client = oauth.create_client(provider)
    if client is None:
        raise HTTPException(status_code=503, detail="Social sign-in is not configured")

    try:
        token = await client.authorize_access_token(request)
        email = None
        email_verified = False

        if provider == "google":
            profile = token.get("userinfo")
            if not profile:
                profile = (await client.get("https://openidconnect.googleapis.com/v1/userinfo", token=token)).json()
            subject = str(profile["sub"])
            provider_username = profile.get("name") or profile.get("email", "google-user")
            email = profile.get("email")
            email_verified = bool(profile.get("email_verified"))
        elif provider == "github":
            profile = (await client.get("user", token=token)).json()
            subject = str(profile["id"])
            provider_username = profile.get("login") or "github-user"
            email = profile.get("email")
            if not email:
                email_response = await client.get("user/emails", token=token)
                verified_emails = [entry for entry in email_response.json() if entry.get("verified")]
                primary_email = next((entry for entry in verified_emails if entry.get("primary")), None)
                selected_email = primary_email or (verified_emails[0] if verified_emails else None)
                if selected_email:
                    email = selected_email.get("email")
            email_verified = bool(email)
        else:
            profile_response = await client.get("users/me?user.fields=id,name,username", token=token)
            profile = profile_response.json().get("data", {})
            subject = str(profile["id"])
            provider_username = profile.get("username") or profile.get("name") or "x-user"

        user = db.query(User).filter(
            User.auth_provider == provider,
            User.auth_subject == subject,
        ).first()

        if user is None and email and email_verified:
            user = db.query(User).filter(func.lower(User.email) == email.lower()).first()
            if user and user.auth_subject and (
                user.auth_provider != provider or user.auth_subject != subject
            ):
                raise HTTPException(status_code=409, detail="This account is linked to another identity provider")
            if user:
                user.auth_provider = provider
                user.auth_subject = subject

        if user is None:
            base_username = re.sub(r"[^A-Za-z0-9_.-]", "", provider_username)[:24] or f"{provider}-user"
            candidate = base_username
            suffix = 1
            while db.query(User.id).filter(func.lower(User.username) == candidate.lower()).first():
                suffix_text = str(suffix)
                candidate = f"{base_username[:24 - len(suffix_text)]}{suffix_text}"
                suffix += 1
            user = User(
                username=candidate,
                email=email.lower() if email and email_verified else None,
                password_hash=hash_password(secrets.token_urlsafe(32)),
                auth_provider=provider,
                auth_subject=subject,
            )
            db.add(user)

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=409, detail="Could not link this social account")
        db.refresh(user)
        return oauth_result_page(user.id, user.username)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Social sign-in failed. Check provider settings and try again.")

@app.get("/api/rooms")
def get_rooms(db: Session = Depends(get_db)):
    rooms = db.query(Room).all()
    if not rooms:
        default_room = Room(name="General Chat", is_archived=False)
        db.add(default_room)
        db.commit()
        db.refresh(default_room)
        rooms = [default_room]
    return rooms

@app.post("/api/rooms", status_code=status.HTTP_201_CREATED)
def create_room(room_data: RoomCreate, db: Session = Depends(get_db)):
    existing_room = db.query(Room).filter(Room.name == room_data.name).first()
    if existing_room:
        raise HTTPException(status_code=400, detail="Room name already exists")
    
    new_room = Room(name=room_data.name, is_archived=False)
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return new_room

@app.put("/api/rooms/{room_id}/archive")
def toggle_room_archive(room_id: int, data: RoomArchiveUpdate, db: Session = Depends(get_db)):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room.is_archived = data.is_archived
    db.commit()
    return {"message": "Room archive status updated", "is_archived": room.is_archived}

@app.get("/api/rooms/{room_id}/messages")
def get_room_messages(room_id: int, db: Session = Depends(get_db)):
    messages = db.query(Message).filter(Message.room_id == room_id).order_by(Message.timestamp.asc()).all()
    result = []
    for msg in messages:
        result.append({
            "id": msg.id,
            "user_id": msg.user_id,
            "username": msg.author.username if msg.author else "Unknown",
            "content": msg.content,
            "timestamp": msg.timestamp.isoformat()
        })
    return result

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, room_id: int, websocket: WebSocket):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)

    def disconnect(self, room_id: int, websocket: WebSocket):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]

    async def broadcast(self, room_id: int, message: Dict[str, Any]):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                await connection.send_json(message)

manager = ConnectionManager()

VOICE_NOTE_MAX_BYTES = 8 * 1024 * 1024
VOICE_NOTE_MIME_TYPES = {
    "audio/aac",
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/x-m4a",
}


def normalize_chat_content(data: str) -> str:
    try:
        payload = json.loads(data)
    except json.JSONDecodeError:
        return data

    if not isinstance(payload, dict):
        return data
    payload = cast(Dict[str, Any], payload)
    if payload.get("type") != "voice_note":
        return data

    mime_type = payload.get("mime_type")
    audio_base64 = payload.get("audio_base64")
    duration = payload.get("duration_seconds")
    if not isinstance(mime_type, str) or mime_type.lower() not in VOICE_NOTE_MIME_TYPES:
        raise ValueError("Voice note audio type is not supported")
    if not isinstance(audio_base64, str):
        raise ValueError("Voice note audio data is missing")
    max_base64_length = ((VOICE_NOTE_MAX_BYTES + 2) // 3) * 4
    if not audio_base64 or len(audio_base64) > max_base64_length:
        raise ValueError("Voice note is empty or too large")
    try:
        audio_bytes = base64.b64decode(audio_base64, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("Voice note audio data is invalid") from error
    if not audio_bytes or len(audio_bytes) > VOICE_NOTE_MAX_BYTES:
        raise ValueError("Voice note is empty or too large")
    if (
        isinstance(duration, bool)
        or not isinstance(duration, (int, float))
        or not math.isfinite(duration)
        or duration < 0
        or duration > 300
    ):
        raise ValueError("Voice note duration must be 5 minutes or less")

    return json.dumps(
        {
            "type": "voice_note",
            "mime_type": mime_type.lower(),
            "audio_base64": audio_base64,
            "duration_seconds": duration,
        },
        separators=(",", ":"),
        allow_nan=False,
    )


@app.websocket("/ws/chat/{room_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: int, user_id: int, db: Session = Depends(get_db)):
    await manager.connect(room_id, websocket)
    user = db.query(User).filter(User.id == user_id).first()
    username = user.username if user else "Anonymous"

    try:
        while True:
            data = await websocket.receive_text()
            try:
                content = normalize_chat_content(data)
            except ValueError as error:
                await websocket.send_json({"type": "error", "detail": str(error)})
                continue
            new_message = Message(
                room_id=room_id,
                user_id=user_id,
                content=content
            )
            db.add(new_message)
            db.commit()
            db.refresh(new_message)

            payload: Dict[str, Any] = {
                "user_id": user_id,
                "username": username,
                "content": content,
                "timestamp": new_message.timestamp.isoformat()
            }
            await manager.broadcast(room_id, payload)
    except WebSocketDisconnect:
        manager.disconnect(room_id, websocket)
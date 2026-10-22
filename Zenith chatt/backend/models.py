from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, nullable=True)
    password_hash = Column(String)
    auth_provider = Column(String, nullable=True)
    auth_subject = Column(String, nullable=True)

    messages = relationship("Message", back_populates="author")

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    is_archived = Column(Boolean, default=False)

    messages = relationship("Message", back_populates="room", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    content = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

    room = relationship("Room", back_populates="messages")
    author = relationship("User", back_populates="messages")
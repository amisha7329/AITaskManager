from sqlalchemy import Column, String, Text, Boolean, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    picture = Column(String)

    tasks = relationship("Task", back_populates="owner")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    completed = Column(Boolean, default=False)
    tags = Column(String, default="Others")
    owner_id = Column(String, ForeignKey("users.id"))
    owner = relationship("User", back_populates="tasks")

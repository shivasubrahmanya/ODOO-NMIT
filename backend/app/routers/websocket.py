"""
WebSocket endpoints for real-time updates
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import logging
from typing import List, Dict

router = APIRouter()
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.project_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: int = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if project_id:
            if project_id not in self.project_connections:
                self.project_connections[project_id] = []
            self.project_connections[project_id].append(websocket)

    def disconnect(self, websocket: WebSocket, project_id: int = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if project_id and project_id in self.project_connections:
            if websocket in self.project_connections[project_id]:
                self.project_connections[project_id].remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast_to_project(self, message: str, project_id: int):
        if project_id in self.project_connections:
            for connection in self.project_connections[project_id]:
                try:
                    await connection.send_text(message)
                except:
                    pass

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

@router.websocket("/project/{project_id}")
async def websocket_project_endpoint(websocket: WebSocket, project_id: int):
    await manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            # Echo message to all project members
            await manager.broadcast_to_project(data, project_id)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
        logger.info(f"WebSocket disconnected from project {project_id}")

@router.websocket("/notifications")
async def websocket_notifications_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle notification-specific messages
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket disconnected from notifications")

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import json
import uuid
from datetime import datetime
from ..models.schemas import (
    BaseResponse,
    Agent,
    CreateAgentRequest,
    UpdateAgentPositionRequest,
    UpdateAgentStatusRequest,
    SendAgentMessageRequest,
    AgentMessageResponse,
)
from ..core.database import get_db
from ..core.logger import get_logger

router = APIRouter(prefix="/api/agents", tags=["agents"])
logger = get_logger(__name__)


@router.get("", response_model=BaseResponse)
async def get_agents():
    try:
        db = get_db()
        rows = await db.fetchall("SELECT * FROM agents ORDER BY created_at")
        agents = []
        for row in rows:
            agents.append({
                "id": row['id'],
                "name": row['name'],
                "display_name": row['display_name'],
                "role": row['role'],
                "avatar": row['avatar'],
                "color": row['color'],
                "position": {"x": row['position_x'], "y": row['position_y']},
                "direction": row['direction'],
                "status": row['status'],
                "status_message": row['status_message'],
                "is_active": bool(row['is_active']),
                "assigned_zone": row['assigned_zone'],
                "created_at": row['created_at'],
                "updated_at": row['updated_at'],
            })
        return BaseResponse(data=agents)
    except Exception as e:
        logger.error(f"Error getting agents: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=BaseResponse)
async def create_agent(request: CreateAgentRequest):
    try:
        db = get_db()
        agent_id = f"agent_{uuid.uuid4().hex[:8]}"
        pos = request.position or {"x": 0, "y": 0}
        await db.execute(
            """INSERT INTO agents
            (id, name, display_name, role, avatar, color, position_x, position_y,
             direction, status, assigned_zone, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'down', 'idle', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (agent_id, request.name, request.display_name, request.role,
             request.avatar, request.color, pos.get('x', 0), pos.get('y', 0),
             request.assigned_zone)
        )
        row = await db.fetchone("SELECT * FROM agents WHERE id = ?", (agent_id,))
        return BaseResponse(data={
            "id": row['id'],
            "name": row['name'],
            "display_name": row['display_name'],
            "position": {"x": row['position_x'], "y": row['position_y']},
            "created_at": row['created_at'],
        })
    except Exception as e:
        logger.error(f"Error creating agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{agent_id}", response_model=BaseResponse)
async def update_agent(agent_id: str, request: CreateAgentRequest):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM agents WHERE id = ?", (agent_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Agent not found")
        pos = request.position or {"x": 0, "y": 0}
        await db.execute(
            """UPDATE agents SET
            name = ?, display_name = ?, role = ?, avatar = ?, color = ?,
            position_x = ?, position_y = ?, assigned_zone = ?,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
            (request.name, request.display_name, request.role, request.avatar,
             request.color, pos.get('x', 0), pos.get('y', 0), request.assigned_zone, agent_id)
        )
        return BaseResponse(message="Agent updated")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{agent_id}", response_model=BaseResponse)
async def delete_agent(agent_id: str):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM agents WHERE id = ?", (agent_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Agent not found")
        await db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
        return BaseResponse(message="Agent deleted")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting agent: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{agent_id}/position", response_model=BaseResponse)
async def update_agent_position(agent_id: str, request: UpdateAgentPositionRequest):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM agents WHERE id = ?", (agent_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Agent not found")
        direction = request.direction or "down"
        await db.execute(
            """UPDATE agents SET position_x = ?, position_y = ?, direction = ?,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
            (request.x, request.y, direction, agent_id)
        )
        return BaseResponse(data={"x": request.x, "y": request.y, "direction": direction})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent position: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{agent_id}/status", response_model=BaseResponse)
async def update_agent_status(agent_id: str, request: UpdateAgentStatusRequest):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT id FROM agents WHERE id = ?", (agent_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Agent not found")
        await db.execute(
            """UPDATE agents SET status = ?, status_message = ?,
            updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
            (request.status, request.message, agent_id)
        )
        return BaseResponse(data={"status": request.status, "message": request.message})
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating agent status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{agent_id}/message", response_model=BaseResponse)
async def send_agent_message(agent_id: str, request: SendAgentMessageRequest):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT * FROM agents WHERE id = ?", (agent_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Agent not found")
        response_text = f"收到消息: {request.content[:20]}..."
        await db.execute(
            """INSERT INTO agent_messages
            (agent_id, content, sender, response, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)""",
            (agent_id, request.content, request.sender, response_text)
        )
        message_id = f"msg_{uuid.uuid4().hex[:8]}"
        return BaseResponse(data={
            "message_id": message_id,
            "response": response_text,
            "timestamp": datetime.now(),
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending agent message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{agent_id}/messages", response_model=BaseResponse)
async def get_agent_messages(
    agent_id: str,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    try:
        db = get_db()
        rows = await db.fetchall(
            """SELECT * FROM agent_messages WHERE agent_id = ?
            ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            (agent_id, limit, offset)
        )
        messages = []
        for row in rows:
            messages.append({
                "id": row['id'],
                "content": row['content'],
                "sender": row['sender'],
                "response": row['response'],
                "tokens_used": row['tokens_used'],
                "created_at": row['created_at'],
            })
        return BaseResponse(data=list(reversed(messages)))
    except Exception as e:
        logger.error(f"Error getting agent messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/zones", response_model=BaseResponse)
async def get_agent_zones():
    try:
        db = get_db()
        rows = await db.fetchall(
            "SELECT * FROM agent_zones WHERE is_enabled = 1 ORDER BY sort_order"
        )
        zones = {}
        for row in rows:
            zones[row['id']] = {
                "id": row['id'],
                "name": row['name'],
                "type": row['type'],
                "description": row['description'],
                "position": {"x": row['position_x'], "y": row['position_y']},
                "width": row['width'],
                "height": row['height'],
                "icon": row['icon'],
            }
        return BaseResponse(data=zones)
    except Exception as e:
        logger.error(f"Error getting agent zones: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/token-stats", response_model=BaseResponse)
async def get_token_stats():
    try:
        db = get_db()
        rows = await db.fetchall(
            """SELECT a.id, a.name, a.avatar, COALESCE(SUM(m.tokens_used), 0) as tokens
            FROM agents a LEFT JOIN agent_messages m ON a.id = m.agent_id
            WHERE a.is_active = 1 GROUP BY a.id ORDER BY tokens DESC LIMIT 5"""
        )
        top_agents = []
        total_tokens = 0
        for row in rows:
            tokens = row['tokens'] or 0
            top_agents.append({
                "agent_id": row['id'],
                "name": row['name'],
                "tokens": tokens,
                "avatar": row['avatar'],
            })
            total_tokens += tokens
        return BaseResponse(data={
            "top_agents": top_agents,
            "total_tokens": total_tokens,
            "period": "24h",
        })
    except Exception as e:
        logger.error(f"Error getting token stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

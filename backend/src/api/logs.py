from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from typing import Optional
import asyncio
import json
from datetime import datetime
from ..models.schemas import BaseResponse, LogStats
from ..core.database import get_db
from ..core.logger import get_logger

router = APIRouter(prefix="/api/logs", tags=["logs"])
logger = get_logger(__name__)


@router.get("", response_model=BaseResponse)
async def get_logs(
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    try:
        db = get_db()
        conditions = []
        params = []
        if level:
            conditions.append("level = ?")
            # 将 WARN 映射为 WARNING（Python logging 的标准级别名称）
            level_upper = level.upper()
            if level_upper == "WARN":
                level_upper = "WARNING"
            params.append(level_upper)
        if module:
            conditions.append("module LIKE ?")
            params.append(f"%{module}%")
        if search:
            conditions.append("message LIKE ?")
            params.append(f"%{search}%")
        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time)
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time)
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        count_query = f"SELECT COUNT(*) as total FROM system_logs {where_clause}"
        count_row = await db.fetchone(count_query, tuple(params))
        total = count_row['total'] if count_row else 0
        offset = (page - 1) * page_size
        query = f"""SELECT * FROM system_logs {where_clause}
        ORDER BY timestamp DESC LIMIT ? OFFSET ?"""
        params.extend([page_size, offset])
        rows = await db.fetchall(query, tuple(params))
        items = []
        for row in rows:
            items.append({
                "id": f"log_{row['id']}",
                "timestamp": row['timestamp'],
                "level": row['level'],
                "module": row['module'],
                "message": row['message'],
                "metadata": json.loads(row['metadata']) if row['metadata'] else {},
            })
        return BaseResponse(data={
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        })
    except Exception as e:
        logger.error(f"Error getting logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats", response_model=BaseResponse)
async def get_log_stats():
    try:
        db = get_db()
        total_row = await db.fetchone("SELECT COUNT(*) as total FROM system_logs")
        error_row = await db.fetchone("SELECT COUNT(*) as count FROM system_logs WHERE level = 'ERROR'")
        warn_row = await db.fetchone("SELECT COUNT(*) as count FROM system_logs WHERE level = 'WARNING'")
        info_row = await db.fetchone("SELECT COUNT(*) as count FROM system_logs WHERE level = 'INFO'")
        return BaseResponse(data={
            "total": total_row['total'],
            "error_count": error_row['count'],
            "warn_count": warn_row['count'],
            "info_count": info_row['count'],
        })
    except Exception as e:
        logger.error(f"Error getting log stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("", response_model=BaseResponse)
async def clear_logs():
    try:
        db = get_db()
        await db.execute("DELETE FROM system_logs")
        logger.info("Logs cleared")
        return BaseResponse(message="Logs cleared successfully")
    except Exception as e:
        logger.error(f"Error clearing logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export")
async def export_logs(
    format: str = Query("json", pattern="^(json|csv|txt)$"),
    level: Optional[str] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
):
    try:
        db = get_db()
        conditions = []
        params = []
        if level:
            conditions.append("level = ?")
            # 将 WARN 映射为 WARNING（Python logging 的标准级别名称）
            level_upper = level.upper()
            if level_upper == "WARN":
                level_upper = "WARNING"
            params.append(level_upper)
        if start_time:
            conditions.append("timestamp >= ?")
            params.append(start_time)
        if end_time:
            conditions.append("timestamp <= ?")
            params.append(end_time)
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        query = f"SELECT * FROM system_logs {where_clause} ORDER BY timestamp DESC"
        rows = await db.fetchall(query, tuple(params))
        if format == "json":
            data = []
            for row in rows:
                data.append({
                    "timestamp": row['timestamp'],
                    "level": row['level'],
                    "module": row['module'],
                    "message": row['message'],
                })
            content = json.dumps(data, ensure_ascii=False, indent=2)
            media_type = "application/json"
            filename = f"logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        elif format == "csv":
            lines = ["timestamp,level,module,message"]
            for row in rows:
                msg = row['message'].replace('"', '""')
                lines.append(f"{row['timestamp']},{row['level']},{row['module']},\"{msg}\"")
            content = "\n".join(lines)
            media_type = "text/csv"
            filename = f"logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        else:
            lines = []
            for row in rows:
                lines.append(f"[{row['timestamp']}] [{row['level']}] {row['module']}: {row['message']}")
            content = "\n".join(lines)
            media_type = "text/plain"
            filename = f"logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        from fastapi.responses import Response
        return Response(
            content=content,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"Error exporting logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stream")
async def stream_logs():
    async def log_generator():
        last_id = 0
        while True:
            try:
                db = get_db()
                rows = await db.fetchall(
                    "SELECT * FROM system_logs WHERE id > ? ORDER BY id",
                    (last_id,)
                )
                for row in rows:
                    last_id = row['id']
                    data = {
                        "id": f"log_{row['id']}",
                        "timestamp": row['timestamp'],
                        "level": row['level'],
                        "module": row['module'],
                        "message": row['message'],
                    }
                    yield f"data: {json.dumps(data)}\n\n"
                await asyncio.sleep(1)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in log stream: {e}")
                await asyncio.sleep(1)
    return StreamingResponse(
        log_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )

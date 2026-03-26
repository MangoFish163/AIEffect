"""
日志服务 API 路由
"""
import json
import asyncio
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse

from ..models.schemas import (
    LogBatch, LogEntry, IngestResponse, LogListResponse,
    LogStats, BaseResponse
)
from ..core.database import get_db
from ..services.log_streamer import get_streamer
from ..services.alert_engine import get_alert_engine

router = APIRouter(tags=["logs"])


@router.post("/ingest", response_model=BaseResponse)
async def ingest_logs(batch: LogBatch):
    """
    批量接收日志
    - 支持批量写入，减少IO
    - 异步队列缓冲，削峰填谷
    - 触发告警检查
    """
    try:
        db = await get_db()
        streamer = await get_streamer()
        alert_engine = await get_alert_engine()

        # 转换日志格式
        logs = []
        for log in batch.logs:
            log_dict = {
                "timestamp": log.timestamp,
                "level": log.level.upper(),
                "module": log.module,
                "message": log.message,
                "source_file": log.source_file,
                "source_line": log.source_line,
                "function_name": log.function_name,
                "process_id": log.process_id,
                "thread_id": log.thread_id,
                "trace_id": log.trace_id,
                "span_id": log.span_id,
                "parent_span_id": log.parent_span_id,
                "exception_type": log.exception_type,
                "exception_message": log.exception_message,
                "exception_traceback": log.exception_traceback,
                "metadata": log.metadata
            }
            logs.append(log_dict)

        # 写入数据库
        count = await db.insert_logs(logs)

        # 广播到订阅者和告警引擎
        for log_dict in logs:
            await streamer.broadcast(log_dict)
            await alert_engine.process_log(log_dict)

        return BaseResponse(data={
            "received": len(batch.logs),
            "ingested": count,
            "failed": len(batch.logs) - count,
            "batch_id": batch.batch_id
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/single", response_model=BaseResponse)
async def ingest_single_log(log: LogEntry):
    """接收单条日志"""
    batch = LogBatch(logs=[log], source="single", batch_id=None)
    return await ingest_logs(batch)


@router.get("/logs", response_model=BaseResponse)
async def get_logs(
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    """分页查询日志"""
    try:
        db = await get_db()
        result = await db.query_logs(
            level=level,
            module=module,
            search=search,
            start_time=start_time,
            end_time=end_time,
            page=page,
            page_size=page_size
        )
        return BaseResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/stats", response_model=BaseResponse)
async def get_log_stats():
    """获取日志统计"""
    try:
        db = await get_db()
        stats = await db.get_stats()
        return BaseResponse(data=stats)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/aggregate", response_model=BaseResponse)
async def aggregate_logs(
    group_by: str = Query(..., pattern="^(level|module|hour|day)$"),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None)
):
    """聚合分析日志

    - group_by: 分组方式 (level, module, hour, day)
    - start_time: 开始时间
    - end_time: 结束时间
    - level: 过滤级别
    - module: 过滤模块
    """
    try:
        db = await get_db()
        result = await db.aggregate_logs(
            group_by=group_by,
            start_time=start_time,
            end_time=end_time,
            level=level,
            module=module
        )
        return BaseResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/stats/hourly", response_model=BaseResponse)
async def get_hourly_stats(
    hours: int = Query(24, ge=1, le=168),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None)
):
    """获取小时级统计

    - hours: 查询最近多少小时 (1-168，默认24)
    - level: 过滤级别
    - module: 过滤模块
    """
    try:
        db = await get_db()
        result = await db.get_hourly_stats(hours=hours, level=level, module=module)
        return BaseResponse(data={
            "hours": hours,
            "items": result,
            "total_count": sum(item["count"] for item in result)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/stats/daily", response_model=BaseResponse)
async def get_daily_stats(
    days: int = Query(7, ge=1, le=90),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None)
):
    """获取日级统计

    - days: 查询最近多少天 (1-90，默认7)
    - level: 过滤级别
    - module: 过滤模块
    """
    try:
        db = await get_db()
        result = await db.get_daily_stats(days=days, level=level, module=module)
        return BaseResponse(data={
            "days": days,
            "items": result,
            "total_count": sum(item["count"] for item in result)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/logs/stats/modules", response_model=BaseResponse)
async def get_module_stats(
    limit: int = Query(20, ge=1, le=100)
):
    """获取模块统计

    - limit: 返回前N个模块 (1-100，默认20)
    """
    try:
        db = await get_db()
        result = await db.get_module_stats(limit=limit)
        return BaseResponse(data={
            "limit": limit,
            "items": result,
            "total_modules": len(result)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stream")
async def stream_logs(
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None)
):
    """
    SSE 实时日志流
    - 支持级别过滤
    - 支持模块过滤
    - 自动重连机制
    """
    streamer = await get_streamer()
    subscriber = await streamer.subscribe(filter_level=level, filter_module=module)
    
    async def event_generator():
        try:
            while True:
                try:
                    # 等待日志，超时发送心跳
                    log = await asyncio.wait_for(
                        subscriber.queue.get(),
                        timeout=30.0
                    )
                    data = json.dumps(log, default=str)
                    yield f"data: {data}\n\n"
                except asyncio.TimeoutError:
                    # 发送心跳保持连接
                    yield ":heartbeat\n\n"
        except asyncio.CancelledError:
            await streamer.unsubscribe(subscriber.session_id)
            raise
        except Exception:
            await streamer.unsubscribe(subscriber.session_id)
            
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.get("/stream/modules", response_model=BaseResponse)
async def get_active_modules():
    """获取当前活跃的模块列表"""
    streamer = await get_streamer()
    modules = await streamer.get_active_modules()
    return BaseResponse(data=modules)


@router.get("/archives", response_model=BaseResponse)
async def list_archives(
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None)
):
    """获取归档列表"""
    try:
        db = await get_db()
        archives = await db.get_archives(start_time=start_time, end_time=end_time)
        return BaseResponse(data={
            "archives": archives,
            "total": len(archives)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/archives", response_model=BaseResponse)
async def create_archive(
    table_name: str
):
    """归档指定表

    - table_name: 表名 (如: logs_2024_01)
    """
    try:
        db = await get_db()
        result = await db.archive_table(table_name)
        return BaseResponse(data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/archives/auto", response_model=BaseResponse)
async def auto_archive(
    months: int = Query(3, ge=1, le=12)
):
    """自动归档旧日志

    - months: 归档多少个月之前的日志 (默认3个月)
    """
    try:
        db = await get_db()
        results = await db.auto_archive_old_logs(months=months)
        return BaseResponse(data={
            "months": months,
            "results": results,
            "archived_count": len([r for r in results if r.get("status") == "archived"]),
            "failed_count": len([r for r in results if r.get("status") == "failed"])
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/archives/{archive_id}/restore", response_model=BaseResponse)
async def restore_archive(
    archive_id: int,
    target_table: Optional[str] = None
):
    """从归档恢复数据"""
    try:
        db = await get_db()
        result = await db.restore_archive(archive_id, target_table)
        return BaseResponse(data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/logs", response_model=BaseResponse)
async def clear_logs(
    before: Optional[datetime] = Query(None),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    confirm: bool = Query(False)
):
    """清空日志（支持条件删除）

    - before: 删除此时间之前的日志
    - level: 只删除指定级别的日志
    - module: 只删除指定模块的日志
    - confirm: 必须设置为 true 才能执行删除
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Please set confirm=true to perform deletion"
        )

    try:
        db = await get_db()

        # 获取需要清理的表
        tables = await db._get_tables_in_range(None, before)

        if not tables:
            return BaseResponse(message="No logs to clear")

        deleted_count = 0

        for table in tables:
            conditions = []
            params = []

            if before:
                conditions.append("timestamp <= ?")
                params.append(before.isoformat())
            if level:
                conditions.append("level = ?")
                params.append(level.upper())
            if module:
                conditions.append("module LIKE ?")
                params.append(f"%{module}%")

            if conditions:
                where_clause = "WHERE " + " AND ".join(conditions)
                # 先获取要删除的数量
                cursor = await db.db.execute(
                    f"SELECT COUNT(*) FROM {table} {where_clause}",
                    params
                )
                count = (await cursor.fetchone())[0]

                # 执行删除
                await db.db.execute(
                    f"DELETE FROM {table} {where_clause}",
                    params
                )
                deleted_count += count
            else:
                # 删除整个表
                cursor = await db.db.execute(f"SELECT COUNT(*) FROM {table}")
                count = (await cursor.fetchone())[0]
                await db.db.execute(f"DROP TABLE IF EXISTS {table}")
                await db.db.execute(f"DROP TABLE IF EXISTS {table}_fts")
                deleted_count += count

        await db.db.commit()

        return BaseResponse(data={
            "deleted_count": deleted_count,
            "tables_affected": len(tables)
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export")
async def export_logs(
    format: str = Query("json", pattern="^(json|csv|txt)$"),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_time: Optional[datetime] = Query(None),
    end_time: Optional[datetime] = Query(None),
    max_records: int = Query(10000, ge=1, le=100000)
):
    """导出日志

    - format: 导出格式 (json, csv, txt)
    - level: 过滤级别
    - module: 过滤模块
    - search: 全文搜索
    - start_time: 开始时间
    - end_time: 结束时间
    - max_records: 最大记录数
    """
    try:
        db = await get_db()

        # 查询日志
        result = await db.query_logs(
            level=level,
            module=module,
            search=search,
            start_time=start_time,
            end_time=end_time,
            page=1,
            page_size=max_records
        )

        items = result.get("items", [])

        if format == "json":
            content = json.dumps({
                "exported_at": datetime.utcnow().isoformat(),
                "total": len(items),
                "filters": {
                    "level": level,
                    "module": module,
                    "search": search,
                    "start_time": start_time.isoformat() if start_time else None,
                    "end_time": end_time.isoformat() if end_time else None
                },
                "logs": items
            }, ensure_ascii=False, indent=2, default=str)

            filename = f"logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            media_type = "application/json"

        elif format == "csv":
            import csv
            import io

            output = io.StringIO()
            writer = csv.writer(output)

            # 写入表头
            writer.writerow([
                "timestamp", "level", "module", "message",
                "source_file", "source_line", "exception_type"
            ])

            # 写入数据
            for item in items:
                writer.writerow([
                    item.get("timestamp"),
                    item.get("level"),
                    item.get("module"),
                    item.get("message"),
                    item.get("source_file"),
                    item.get("source_line"),
                    item.get("exception_type")
                ])

            content = output.getvalue()
            output.close()

            filename = f"logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            media_type = "text/csv"

        else:  # txt
            lines = []
            lines.append(f"Logs Export - {datetime.utcnow().isoformat()}")
            lines.append(f"Total: {len(items)} records")
            lines.append("-" * 80)

            for item in items:
                timestamp = item.get("timestamp", "")
                level = item.get("level", "")
                module = item.get("module", "")
                message = item.get("message", "")
                lines.append(f"[{timestamp}] [{level}] [{module}] {message}")

            content = "\n".join(lines)
            filename = f"logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            media_type = "text/plain"

        from fastapi.responses import PlainTextResponse

        if format == "json":
            return PlainTextResponse(
                content=content,
                media_type=media_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
        else:
            return PlainTextResponse(
                content=content,
                media_type=media_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

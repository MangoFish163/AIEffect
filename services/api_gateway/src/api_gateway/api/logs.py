"""
日志API - 代理到独立日志服务

为了保持向后兼容，API Gateway 保留 /api/logs 接口，但将其代理到独立的日志服务
"""
import asyncio
from fastapi import APIRouter, HTTPException, Query, Request, Path
from fastapi.responses import StreamingResponse, Response
from typing import Optional
import aiohttp
import json
import os
from datetime import datetime
from ..models.schemas import BaseResponse
from shared_core import get_logger

router = APIRouter(prefix="/api/logs", tags=["logs"])
logger = get_logger(__name__)

# 独立日志服务地址
LOG_SERVICE_URL = os.getenv("LOG_SERVICE_URL", "http://localhost:8505")


async def _proxy_request(method: str, path: str, params: dict = None, json_data: dict = None):
    """代理请求到日志服务"""
    url = f"{LOG_SERVICE_URL}{path}"
    async with aiohttp.ClientSession() as session:
        try:
            async with session.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status == 200:
                    return await response.json()
                elif response.status == 404:
                    return {"error": "Not found", "status": 404}
                else:
                    text = await response.text()
                    logger.warning(f"Log service returned {response.status}: {text}")
                    return {"error": text, "status": response.status}
        except aiohttp.ClientError as e:
            logger.warning(f"Log service connection error: {e}")
            return None


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
    """获取日志列表（代理到日志服务）"""
    params = {
        "page": page,
        "page_size": page_size
    }
    if level:
        params["level"] = level
    if module:
        params["module"] = module
    if search:
        params["search"] = search
    if start_time:
        params["start_time"] = start_time
    if end_time:
        params["end_time"] = end_time

    result = await _proxy_request("GET", "/logs", params=params)
    if result is None:
        # 日志服务不可用，返回空数据
        return BaseResponse(data={
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 0
        })
    return BaseResponse(data=result.get("data", result))


@router.get("/stats", response_model=BaseResponse)
async def get_log_stats():
    """获取日志统计（代理到日志服务）"""
    result = await _proxy_request("GET", "/logs/stats")
    if result is None:
        # 日志服务不可用，返回默认统计
        return BaseResponse(data={
            "total": 0,
            "error_count": 0,
            "warn_count": 0,
            "info_count": 0,
            "debug_count": 0
        })
    return BaseResponse(data=result.get("data", result))


@router.get("/stats/hourly", response_model=BaseResponse)
async def get_hourly_stats(
    hours: int = Query(24, ge=1, le=168),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None)
):
    """获取小时级统计（代理到日志服务）"""
    params = {"hours": hours}
    if level:
        params["level"] = level
    if module:
        params["module"] = module

    result = await _proxy_request("GET", "/logs/stats/hourly", params=params)
    if result is None:
        return BaseResponse(data={"hours": hours, "items": [], "total_count": 0})
    return BaseResponse(data=result.get("data", result))


@router.get("/stats/daily", response_model=BaseResponse)
async def get_daily_stats(
    days: int = Query(7, ge=1, le=90),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None)
):
    """获取日级统计（代理到日志服务）"""
    params = {"days": days}
    if level:
        params["level"] = level
    if module:
        params["module"] = module

    result = await _proxy_request("GET", "/logs/stats/daily", params=params)
    if result is None:
        return BaseResponse(data={"days": days, "items": [], "total_count": 0})
    return BaseResponse(data=result.get("data", result))


@router.get("/stats/modules", response_model=BaseResponse)
async def get_module_stats(
    limit: int = Query(20, ge=1, le=100)
):
    """获取模块统计（代理到日志服务）"""
    params = {"limit": limit}

    result = await _proxy_request("GET", "/logs/stats/modules", params=params)
    if result is None:
        return BaseResponse(data={"limit": limit, "items": [], "total_modules": 0})
    return BaseResponse(data=result.get("data", result))


@router.get("/aggregate", response_model=BaseResponse)
async def aggregate_logs(
    group_by: str = Query(..., pattern="^(level|module|hour|day)$"),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None)
):
    """聚合分析日志（代理到日志服务）"""
    params = {"group_by": group_by}
    if start_time:
        params["start_time"] = start_time
    if end_time:
        params["end_time"] = end_time
    if level:
        params["level"] = level
    if module:
        params["module"] = module

    result = await _proxy_request("GET", "/logs/aggregate", params=params)
    if result is None:
        return BaseResponse(data={"group_by": group_by, "items": [], "total_count": 0})
    return BaseResponse(data=result.get("data", result))


@router.delete("", response_model=BaseResponse)
async def clear_logs(
    before: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    confirm: bool = Query(False)
):
    """清空日志（代理到日志服务）"""
    params = {"confirm": confirm}
    if before:
        params["before"] = before
    if level:
        params["level"] = level
    if module:
        params["module"] = module

    result = await _proxy_request("DELETE", "/logs", params=params)
    if result is None:
        return BaseResponse(message="Log service unavailable, logs not cleared")
    return BaseResponse(data=result.get("data", {}), message=result.get("message", "Logs cleared"))


@router.get("/export")
async def export_logs(
    format: str = Query("json", pattern="^(json|csv|txt)$"),
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    max_records: int = Query(10000, ge=1, le=100000)
):
    """导出日志（代理到日志服务）"""
    params = {
        "format": format,
        "max_records": max_records
    }
    if level:
        params["level"] = level
    if module:
        params["module"] = module
    if search:
        params["search"] = search
    if start_time:
        params["start_time"] = start_time
    if end_time:
        params["end_time"] = end_time

    url = f"{LOG_SERVICE_URL}/export"
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=60)) as response:
                if response.status == 200:
                    content = await response.read()
                    media_type = response.headers.get("Content-Type", "application/octet-stream")
                    content_disposition = response.headers.get("Content-Disposition", "")
                    return Response(
                        content=content,
                        media_type=media_type,
                        headers={"Content-Disposition": content_disposition} if content_disposition else {}
                    )
                else:
                    text = await response.text()
                    logger.warning(f"Log service export returned {response.status}: {text}")
    except aiohttp.ClientError as e:
        logger.warning(f"Log service connection error: {e}")

    # 日志服务不可用，返回空文件
    content = "[]" if format == "json" else ""
    media_type = "application/json" if format == "json" else "text/plain"
    filename = f"logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{format}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/stream")
async def stream_logs(
    level: Optional[str] = Query(None),
    module: Optional[str] = Query(None)
):
    """SSE 日志流（代理到日志服务）"""
    params = {}
    if level:
        params["level"] = level
    if module:
        params["module"] = module

    async def proxy_generator():
        url = f"{LOG_SERVICE_URL}/stream"
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(url, params=params, timeout=aiohttp.ClientTimeout(total=None)) as response:
                    async for line in response.content:
                        yield line.decode('utf-8')
        except asyncio.CancelledError:
            pass
        except aiohttp.ClientError as e:
            logger.warning(f"Log service stream connection error: {e}")
            # 返回一个空的心跳保持连接
            while True:
                yield ":heartbeat\n\n"
                await asyncio.sleep(30)
        except Exception as e:
            logger.error(f"Log stream error: {e}")
            yield ":error\n\n"

    return StreamingResponse(
        proxy_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/stream/modules", response_model=BaseResponse)
async def get_active_modules():
    """获取活跃模块列表（代理到日志服务）"""
    result = await _proxy_request("GET", "/stream/modules")
    if result is None:
        return BaseResponse(data=[])
    return BaseResponse(data=result.get("data", result))


# ==================== 归档相关接口 ====================

@router.get("/archives", response_model=BaseResponse)
async def list_archives(
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None)
):
    """获取归档列表（代理到日志服务）"""
    params = {}
    if start_time:
        params["start_time"] = start_time
    if end_time:
        params["end_time"] = end_time

    result = await _proxy_request("GET", "/archives", params=params)
    if result is None:
        return BaseResponse(data={"archives": [], "total": 0})
    return BaseResponse(data=result.get("data", result))


@router.post("/archives", response_model=BaseResponse)
async def create_archive(
    table_name: str
):
    """归档指定表（代理到日志服务）"""
    result = await _proxy_request("POST", "/archives", params={"table_name": table_name})
    if result is None:
        raise HTTPException(status_code=503, detail="Log service unavailable")
    if "error" in result:
        raise HTTPException(status_code=result.get("status", 500), detail=result["error"])
    return BaseResponse(data=result.get("data", result))


@router.post("/archives/auto", response_model=BaseResponse)
async def auto_archive(
    months: int = Query(3, ge=1, le=12)
):
    """自动归档旧日志（代理到日志服务）"""
    result = await _proxy_request("POST", "/archives/auto", params={"months": months})
    if result is None:
        raise HTTPException(status_code=503, detail="Log service unavailable")
    return BaseResponse(data=result.get("data", result))


@router.post("/archives/{archive_id}/restore", response_model=BaseResponse)
async def restore_archive(
    archive_id: int = Path(..., ge=1),
    target_table: Optional[str] = None
):
    """从归档恢复数据（代理到日志服务）"""
    params = {}
    if target_table:
        params["target_table"] = target_table

    result = await _proxy_request("POST", f"/archives/{archive_id}/restore", params=params)
    if result is None:
        raise HTTPException(status_code=503, detail="Log service unavailable")
    if "error" in result:
        raise HTTPException(status_code=result.get("status", 500), detail=result["error"])
    return BaseResponse(data=result.get("data", result))


# ==================== 告警相关接口 ====================

@router.get("/alerts/rules", response_model=BaseResponse)
async def list_alert_rules(
    enabled: Optional[bool] = Query(None)
):
    """获取告警规则列表（代理到日志服务）"""
    params = {}
    if enabled is not None:
        params["enabled"] = enabled

    result = await _proxy_request("GET", "/alerts/rules", params=params)
    if result is None:
        return BaseResponse(data=[])
    return BaseResponse(data=result.get("data", result))


@router.get("/alerts/rules/{rule_id}", response_model=BaseResponse)
async def get_alert_rule(
    rule_id: int = Path(..., ge=1)
):
    """获取单个告警规则（代理到日志服务）"""
    result = await _proxy_request("GET", f"/alerts/rules/{rule_id}")
    if result is None:
        raise HTTPException(status_code=503, detail="Log service unavailable")
    if "error" in result:
        raise HTTPException(status_code=result.get("status", 404), detail=result["error"])
    return BaseResponse(data=result.get("data", result))


@router.post("/alerts/rules", response_model=BaseResponse)
async def create_alert_rule(request: Request):
    """创建告警规则（代理到日志服务）"""
    body = await request.json()
    result = await _proxy_request("POST", "/alerts/rules", json_data=body)
    if result is None:
        raise HTTPException(status_code=503, detail="Log service unavailable")
    if "error" in result:
        raise HTTPException(status_code=result.get("status", 500), detail=result["error"])
    return BaseResponse(data=result.get("data", result))


@router.put("/alerts/rules/{rule_id}", response_model=BaseResponse)
async def update_alert_rule(
    request: Request,
    rule_id: int = Path(..., ge=1)
):
    """更新告警规则（代理到日志服务）"""
    body = await request.json()
    result = await _proxy_request("PUT", f"/alerts/rules/{rule_id}", json_data=body)
    if result is None:
        raise HTTPException(status_code=503, detail="Log service unavailable")
    if "error" in result:
        raise HTTPException(status_code=result.get("status", 404), detail=result["error"])
    return BaseResponse(data=result.get("data", result))


@router.delete("/alerts/rules/{rule_id}", response_model=BaseResponse)
async def delete_alert_rule(
    rule_id: int = Path(..., ge=1)
):
    """删除告警规则（代理到日志服务）"""
    result = await _proxy_request("DELETE", f"/alerts/rules/{rule_id}")
    if result is None:
        raise HTTPException(status_code=503, detail="Log service unavailable")
    if "error" in result:
        raise HTTPException(status_code=result.get("status", 404), detail=result["error"])
    return BaseResponse(message=result.get("message", f"Alert rule {rule_id} deleted"))


@router.post("/alerts/rules/{rule_id}/toggle", response_model=BaseResponse)
async def toggle_alert_rule(
    rule_id: int = Path(..., ge=1)
):
    """切换告警规则启用状态（代理到日志服务）"""
    result = await _proxy_request("POST", f"/alerts/rules/{rule_id}/toggle")
    if result is None:
        raise HTTPException(status_code=503, detail="Log service unavailable")
    if "error" in result:
        raise HTTPException(status_code=result.get("status", 404), detail=result["error"])
    return BaseResponse(data=result.get("data", result))


@router.get("/alerts/history", response_model=BaseResponse)
async def get_alert_history(
    rule_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    start_time: Optional[str] = Query(None),
    end_time: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200)
):
    """获取告警历史（代理到日志服务）"""
    params = {"page": page, "page_size": page_size}
    if rule_id:
        params["rule_id"] = rule_id
    if severity:
        params["severity"] = severity
    if start_time:
        params["start_time"] = start_time
    if end_time:
        params["end_time"] = end_time

    result = await _proxy_request("GET", "/alerts/history", params=params)
    if result is None:
        return BaseResponse(data={"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 0})
    return BaseResponse(data=result.get("data", result))


@router.get("/alerts/active", response_model=BaseResponse)
async def get_active_alerts():
    """获取当前活跃的告警（代理到日志服务）"""
    result = await _proxy_request("GET", "/alerts/active")
    if result is None:
        return BaseResponse(data=[])
    return BaseResponse(data=result.get("data", result))


@router.post("/alerts/reload", response_model=BaseResponse)
async def reload_alert_rules():
    """重新加载告警规则（代理到日志服务）"""
    result = await _proxy_request("POST", "/alerts/reload")
    if result is None:
        raise HTTPException(status_code=503, detail="Log service unavailable")
    return BaseResponse(message=result.get("message", "Alert rules reloaded"))

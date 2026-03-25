from fastapi import APIRouter, HTTPException
from typing import List, Optional
import uuid
import httpx
from datetime import datetime
from ..models.schemas import (
    BaseResponse,
    ProviderPreset,
    CreateProviderPresetRequest,
    UpdateProviderPresetRequest,
)
from ..core.database import get_db
from ..core.logger import get_logger
from ..core.config import get_config_manager

router = APIRouter(prefix="/api/providers", tags=["providers"])
logger = get_logger(__name__)


def _row_to_preset(row) -> dict:
    return {
        "id": row['id'],
        "name": row['name'],
        "icon": row['icon'],
        "api_url": row['api_url'],
        "api_key": row['api_key'] if row['api_key'] else None,
        "model_name": row['model_name'],
        "doc_url": row['doc_url'],
        "is_custom": bool(row['is_custom']),
        "is_builtin": bool(row['is_builtin']),
        "sort_order": row['sort_order'],
    }


@router.get("", response_model=BaseResponse)
async def get_providers():
    try:
        db = get_db()
        rows = await db.fetchall(
            "SELECT * FROM provider_presets ORDER BY is_builtin DESC, sort_order ASC"
        )
        builtin = []
        custom = []
        for row in rows:
            preset = _row_to_preset(row)
            if preset['is_builtin']:
                builtin.append(preset)
            else:
                custom.append(preset)
        return BaseResponse(data={"builtin": builtin, "custom": custom})
    except Exception as e:
        logger.error(f"Error getting providers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=BaseResponse)
async def create_provider(request: CreateProviderPresetRequest):
    try:
        db = get_db()
        preset_id = f"custom_{uuid.uuid4().hex[:8]}"
        await db.execute(
            """INSERT INTO provider_presets
            (id, name, icon, api_url, api_key, model_name, doc_url, is_custom, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (preset_id, request.name, request.icon, request.api_url,
             request.api_key, request.model_name, request.doc_url)
        )
        row = await db.fetchone("SELECT * FROM provider_presets WHERE id = ?", (preset_id,))
        logger.info(f"Provider preset created: {preset_id}")
        return BaseResponse(data=_row_to_preset(row))
    except Exception as e:
        logger.error(f"Error creating provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{preset_id}", response_model=BaseResponse)
async def update_provider(preset_id: str, request: UpdateProviderPresetRequest):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT * FROM provider_presets WHERE id = ?", (preset_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Provider preset not found")
        if existing['is_builtin']:
            raise HTTPException(status_code=403, detail="Cannot modify builtin preset")
        updates = []
        params = []
        if request.name is not None:
            updates.append("name = ?")
            params.append(request.name)
        if request.icon is not None:
            updates.append("icon = ?")
            params.append(request.icon)
        if request.api_url is not None:
            updates.append("api_url = ?")
            params.append(request.api_url)
        if request.api_key is not None:
            updates.append("api_key = ?")
            params.append(request.api_key)
        if request.model_name is not None:
            updates.append("model_name = ?")
            params.append(request.model_name)
        if request.doc_url is not None:
            updates.append("doc_url = ?")
            params.append(request.doc_url)
        if not updates:
            return BaseResponse(data=_row_to_preset(existing))
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(preset_id)
        query = f"UPDATE provider_presets SET {', '.join(updates)} WHERE id = ?"
        await db.execute(query, tuple(params))
        row = await db.fetchone("SELECT * FROM provider_presets WHERE id = ?", (preset_id,))
        logger.info(f"Provider preset updated: {preset_id}")
        return BaseResponse(data=_row_to_preset(row))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{preset_id}", response_model=BaseResponse)
async def delete_provider(preset_id: str):
    try:
        db = get_db()
        existing = await db.fetchone("SELECT * FROM provider_presets WHERE id = ?", (preset_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Provider preset not found")
        if existing['is_builtin']:
            raise HTTPException(status_code=403, detail="Cannot delete builtin preset")
        await db.execute("DELETE FROM provider_presets WHERE id = ?", (preset_id,))
        logger.info(f"Provider preset deleted: {preset_id}")
        return BaseResponse(message="Provider preset deleted successfully")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting provider: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test", response_model=BaseResponse)
async def test_provider_connection(
    api_url: str,
    api_key: str,
    model_name: str
):
    """测试模型连接"""
    try:
        import time
        start_time = time.time()
        
        headers = {
            "Content-Type": "application/json"
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        
        # 尝试获取模型列表
        models_url = f"{api_url.rstrip('/')}/models"
        model_list = []
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(models_url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, dict) and "data" in data:
                        model_list = [m.get("id", m.get("name", "")) for m in data["data"]]
                    elif isinstance(data, list):
                        model_list = [m.get("id", m.get("name", "")) for m in data]
            except Exception as e:
                logger.warning(f"Failed to fetch model list: {e}")
        
        # 尝试发送一个简单的测试请求
        chat_url = f"{api_url.rstrip('/')}/chat/completions"
        test_payload = {
            "model": model_name or "default",
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 5,
            "stream": False
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(chat_url, json=test_payload, headers=headers)
            latency_ms = int((time.time() - start_time) * 1000)
            
            if response.status_code == 200:
                return BaseResponse(data={
                    "success": True,
                    "latency_ms": latency_ms,
                    "model_list": model_list[:20] if model_list else None,
                    "message": f"连接成功，延迟 {latency_ms}ms"
                })
            elif response.status_code == 401:
                return BaseResponse(data={
                    "success": False,
                    "latency_ms": latency_ms,
                    "model_list": model_list[:20] if model_list else None,
                    "message": "API Key 无效或已过期"
                })
            elif response.status_code == 404:
                return BaseResponse(data={
                    "success": False,
                    "latency_ms": latency_ms,
                    "model_list": model_list[:20] if model_list else None,
                    "message": "模型不存在或接口地址错误"
                })
            else:
                return BaseResponse(data={
                    "success": False,
                    "latency_ms": latency_ms,
                    "model_list": model_list[:20] if model_list else None,
                    "message": f"请求失败: HTTP {response.status_code}"
                })
                
    except httpx.TimeoutException:
        return BaseResponse(data={
            "success": False,
            "latency_ms": None,
            "model_list": None,
            "message": "连接超时，请检查网络或接口地址"
        })
    except httpx.ConnectError:
        return BaseResponse(data={
            "success": False,
            "latency_ms": None,
            "model_list": None,
            "message": "无法连接到服务器，请检查接口地址"
        })
    except Exception as e:
        logger.error(f"Error testing provider connection: {e}")
        return BaseResponse(data={
            "success": False,
            "latency_ms": None,
            "model_list": None,
            "message": f"测试失败: {str(e)}"
        })

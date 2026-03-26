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
from shared_core import get_db, get_logger, get_config_manager

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
        "curl_example": row['curl_example'] if row['curl_example'] else None,
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
            (id, name, icon, api_url, api_key, model_name, doc_url, curl_example, is_custom, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (preset_id, request.name, request.icon, request.api_url,
             request.api_key, request.model_name, request.doc_url, request.curl_example)
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
        if request.curl_example is not None:
            updates.append("curl_example = ?")
            params.append(request.curl_example)
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
    model_name: str,
    curl_example: Optional[str] = None,
    preset_name: Optional[str] = None
):
    """测试模型连接

    Args:
        api_url: 模型API地址
        api_key: API密钥
        model_name: 模型名称
        curl_example: 用户自定义的cURL示例（可选）
        preset_name: 预设名称，用于生成默认cURL时的问候语
    """
    try:
        import time
        import json
        import re
        start_time = time.time()

        # 记录测试开始日志
        test_target = preset_name or model_name or api_url
        logger.info(f"[模型测试] 开始测试 - 目标: {test_target}, URL: {api_url}, 模型: {model_name}")

        # 如果用户提供了cURL示例，解析并使用它
        if curl_example and curl_example.strip():
            logger.info(f"[模型测试] 使用自定义cURL进行测试")
            try:
                result = await _test_with_curl(curl_example, start_time)
                # 记录测试结果
                if result.get("success"):
                    logger.info(f"[模型测试] 测试成功 - 目标: {test_target}, 延迟: {result.get('latency_ms')}ms")
                else:
                    logger.warning(f"[模型测试] 测试失败 - 目标: {test_target}, 原因: {result.get('message')}")
                return BaseResponse(data=result)
            except Exception as e:
                logger.warning(f"[模型测试] 自定义cURL测试失败: {e}, 使用默认方式重试")

        # 使用默认方式测试
        logger.info(f"[模型测试] 使用默认方式测试")
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
                    logger.info(f"[模型测试] 获取模型列表成功 - 共 {len(model_list)} 个模型")
            except Exception as e:
                logger.warning(f"[模型测试] 获取模型列表失败: {e}")

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
                logger.info(f"[模型测试] 测试成功 - 目标: {test_target}, 延迟: {latency_ms}ms")
                return BaseResponse(data={
                    "success": True,
                    "latency_ms": latency_ms,
                    "model_list": model_list[:20] if model_list else None,
                    "message": f"连接成功，延迟 {latency_ms}ms"
                })
            elif response.status_code == 401:
                logger.warning(f"[模型测试] 测试失败 - 目标: {test_target}, 原因: API Key无效")
                return BaseResponse(data={
                    "success": False,
                    "latency_ms": latency_ms,
                    "model_list": model_list[:20] if model_list else None,
                    "message": "API Key 无效或已过期"
                })
            elif response.status_code == 404:
                logger.warning(f"[模型测试] 测试失败 - 目标: {test_target}, 原因: 模型不存在或接口地址错误")
                return BaseResponse(data={
                    "success": False,
                    "latency_ms": latency_ms,
                    "model_list": model_list[:20] if model_list else None,
                    "message": "模型不存在或接口地址错误"
                })
            else:
                logger.warning(f"[模型测试] 测试失败 - 目标: {test_target}, HTTP状态码: {response.status_code}")
                return BaseResponse(data={
                    "success": False,
                    "latency_ms": latency_ms,
                    "model_list": model_list[:20] if model_list else None,
                    "message": f"请求失败: HTTP {response.status_code}"
                })

    except httpx.TimeoutException:
        logger.error(f"[模型测试] 测试失败 - 目标: {preset_name or api_url}, 原因: 连接超时")
        return BaseResponse(data={
            "success": False,
            "latency_ms": None,
            "model_list": None,
            "message": "连接超时，请检查网络或接口地址"
        })
    except httpx.ConnectError:
        logger.error(f"[模型测试] 测试失败 - 目标: {preset_name or api_url}, 原因: 无法连接到服务器")
        return BaseResponse(data={
            "success": False,
            "latency_ms": None,
            "model_list": None,
            "message": "无法连接到服务器，请检查接口地址"
        })
    except Exception as e:
        logger.error(f"[模型测试] 测试异常 - 目标: {preset_name or api_url}, 错误: {e}")
        return BaseResponse(data={
            "success": False,
            "latency_ms": None,
            "model_list": None,
            "message": f"测试失败: {str(e)}"
        })


async def _test_with_curl(curl_example: str, start_time: float) -> dict:
    """使用用户提供的cURL示例进行测试"""
    import re
    import time

    logger.info(f"[模型测试] 开始解析cURL命令")

    # 解析cURL命令
    curl_example = curl_example.strip()

    # 提取URL
    url_match = re.search(r'curl\s+["\']?([^"\'\s]+)["\']?', curl_example)
    if not url_match:
        logger.error(f"[模型测试] 无法解析cURL中的URL")
        raise ValueError("无法解析cURL中的URL")
    url = url_match.group(1)
    logger.info(f"[模型测试] 解析到URL: {url}")

    # 提取Headers - 支持 -H 和 --header 格式
    headers = {}
    # 匹配 -H "key: value" 或 --header "key: value" 或 --header 'key: value'
    header_matches = re.findall(r'(?:-H|--header)\s+["\']([^"\']+)["\']', curl_example)
    for header in header_matches:
        if ':' in header:
            key, value = header.split(':', 1)
            headers[key.strip()] = value.strip()
    logger.info(f"[模型测试] 解析到 {len(headers)} 个Headers: {list(headers.keys())}")

    # 提取请求体
    body = None
    body_match = re.search(r'-d\s+["\'](.+?)["\']\s*$', curl_example, re.DOTALL)
    if body_match:
        body_str = body_match.group(1)
        # 处理转义的引号
        body_str = body_str.replace("\\'", "'").replace('\\"', '"')
        try:
            body = json.loads(body_str)
            logger.info(f"[模型测试] 解析到JSON请求体")
        except:
            body = body_str
            logger.info(f"[模型测试] 解析到文本请求体")

    # 发送请求
    logger.info(f"[模型测试] 使用cURL方式发送请求到: {url}")
    async with httpx.AsyncClient(timeout=30.0) as client:
        if body and isinstance(body, dict):
            response = await client.post(url, json=body, headers=headers)
        else:
            response = await client.post(url, content=body, headers=headers)

        latency_ms = int((time.time() - start_time) * 1000)

        if response.status_code == 200:
            logger.info(f"[模型测试] cURL测试成功 - 延迟: {latency_ms}ms")
            return {
                "success": True,
                "latency_ms": latency_ms,
                "model_list": None,
                "message": f"连接成功，延迟 {latency_ms}ms"
            }
        elif response.status_code == 401:
            logger.warning(f"[模型测试] cURL测试失败 - 原因: API Key无效")
            return {
                "success": False,
                "latency_ms": latency_ms,
                "model_list": None,
                "message": "API Key 无效或已过期"
            }
        elif response.status_code == 404:
            logger.warning(f"[模型测试] cURL测试失败 - 原因: 模型不存在或接口地址错误")
            return {
                "success": False,
                "latency_ms": latency_ms,
                "model_list": None,
                "message": "模型不存在或接口地址错误"
            }
        else:
            logger.warning(f"[模型测试] cURL测试失败 - HTTP状态码: {response.status_code}")
            return {
                "success": False,
                "latency_ms": latency_ms,
                "model_list": None,
                "message": f"请求失败: HTTP {response.status_code}"
            }

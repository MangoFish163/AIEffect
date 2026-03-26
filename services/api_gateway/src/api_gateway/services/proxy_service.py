import httpx
from typing import Optional, Dict, Any, List
from shared_core import get_config_manager, get_logger

logger = get_logger(__name__)


class ProxyService:
    def __init__(self):
        self.config_manager = get_config_manager()
        self.running = False
        self.current_port: Optional[int] = None
        self._client: Optional[httpx.AsyncClient] = None

    async def start_proxy(self, port: Optional[int] = None) -> bool:
        try:
            if port is None:
                port = self.config_manager.config.ports.ollama_proxy
            self.current_port = port
            self.running = True
            logger.info(f"Ollama proxy service started on port {port}")
            return True
        except Exception as e:
            logger.error(f"Failed to start proxy service: {e}")
            return False

    async def stop_proxy(self) -> bool:
        try:
            self.running = False
            self.current_port = None
            if self._client:
                await self._client.aclose()
                self._client = None
            logger.info("Ollama proxy service stopped")
            return True
        except Exception as e:
            logger.error(f"Failed to stop proxy service: {e}")
            return False

    def get_status(self) -> Dict[str, Any]:
        config = self.config_manager.config
        external_address = f"http://0.0.0.0:{self.current_port}" if self.running and config.lan_enabled else None
        return {
            "running": self.running,
            "port": self.current_port,
            "external_address": external_address,
        }

    def _convert_openai_to_ollama(self, openai_request: Dict[str, Any]) -> Dict[str, Any]:
        model = openai_request.get("model", "")
        messages = openai_request.get("messages", [])
        stream = openai_request.get("stream", False)
        
        ollama_request = {
            "model": model,
            "messages": messages,
            "stream": stream,
        }
        
        if "temperature" in openai_request:
            ollama_request["options"] = {
                "temperature": openai_request["temperature"]
            }
        
        return ollama_request

    def _convert_ollama_to_openai(self, ollama_response: Dict[str, Any], model: str) -> Dict[str, Any]:
        message = ollama_response.get("message", {})
        
        openai_response = {
            "id": f"chatcmpl-{ollama_response.get('created', '')}",
            "object": "chat.completion",
            "created": ollama_response.get("created", 0),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": message.get("role", "assistant"),
                        "content": message.get("content", ""),
                    },
                    "finish_reason": "stop" if ollama_response.get("done", True) else None,
                }
            ],
            "usage": {
                "prompt_tokens": ollama_response.get("prompt_eval_count", 0),
                "completion_tokens": ollama_response.get("eval_count", 0),
                "total_tokens": ollama_response.get("prompt_eval_count", 0) + ollama_response.get("eval_count", 0),
            }
        }
        
        return openai_response

    async def forward_chat_completions(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        ollama_base_url = self.config_manager.settings.ollama_base_url
        model = request_data.get("model", "")
        
        try:
            if not self._client:
                self._client = httpx.AsyncClient(timeout=120.0)
            
            ollama_request = self._convert_openai_to_ollama(request_data)
            
            response = await self._client.post(
                f"{ollama_base_url}/api/chat",
                json=ollama_request,
            )
            response.raise_for_status()
            
            ollama_response = response.json()
            openai_response = self._convert_ollama_to_openai(ollama_response, model)
            
            return openai_response
        except Exception as e:
            logger.error(f"Error forwarding chat completions: {e}")
            raise

    async def get_models(self) -> Dict[str, Any]:
        ollama_base_url = self.config_manager.settings.ollama_base_url
        try:
            if not self._client:
                self._client = httpx.AsyncClient(timeout=30.0)
            response = await self._client.get(f"{ollama_base_url}/api/tags")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Error getting models: {e}")
            raise


_proxy_service_instance: Optional[ProxyService] = None


def get_proxy_service() -> ProxyService:
    global _proxy_service_instance
    if _proxy_service_instance is None:
        _proxy_service_instance = ProxyService()
    return _proxy_service_instance

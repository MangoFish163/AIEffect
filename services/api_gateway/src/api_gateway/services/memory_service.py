import json
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from shared_core import get_config_manager, get_logger
from ..models.schemas import Message, CharacterMemory

logger = get_logger(__name__)


class MemoryService:
    def __init__(self):
        self.config_manager = get_config_manager()
        self._memories: Dict[str, CharacterMemory] = {}
        self._load_all_memories()

    def _get_memory_dir(self) -> Path:
        config = self.config_manager.config.memory
        return Path(config.save_dir)

    def _get_memory_path(self, character_name: str) -> Path:
        return self._get_memory_dir() / f"{character_name}.json"

    def _load_all_memories(self):
        memory_dir = self._get_memory_dir()
        if not memory_dir.exists():
            return
        for file_path in memory_dir.glob("*.json"):
            try:
                character_name = file_path.stem
                self._load_memory(character_name)
            except Exception as e:
                logger.warning(f"Failed to load memory from {file_path}: {e}")

    def _load_memory(self, character_name: str) -> Optional[CharacterMemory]:
        file_path = self._get_memory_path(character_name)
        if not file_path.exists():
            return None
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            messages = [Message(**msg) for msg in data.get("messages", [])]
            memory = CharacterMemory(
                character_name=character_name,
                messages=messages,
                last_updated=datetime.fromisoformat(data["last_updated"]),
                compressed_summary=data.get("compressed_summary"),
            )
            self._memories[character_name] = memory
            return memory
        except Exception as e:
            logger.error(f"Failed to load memory for {character_name}: {e}")
            return None

    def _save_memory(self, memory: CharacterMemory):
        file_path = self._get_memory_path(memory.character_name)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "character_name": memory.character_name,
            "messages": [msg.model_dump() for msg in memory.messages],
            "last_updated": memory.last_updated.isoformat(),
            "compressed_summary": memory.compressed_summary,
        }
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_characters(self) -> List[str]:
        return list(self._memories.keys())

    def get_memory(self, character_name: str) -> Optional[CharacterMemory]:
        if character_name in self._memories:
            return self._memories[character_name]
        return self._load_memory(character_name)

    def add_message(self, character_name: str, role: str, content: str):
        memory = self.get_memory(character_name)
        if not memory:
            memory = CharacterMemory(
                character_name=character_name,
                messages=[],
                last_updated=datetime.now(),
            )
        memory.messages.append(Message(role=role, content=content))
        memory.last_updated = datetime.now()
        self._memories[character_name] = memory
        self._save_memory(memory)
        self._check_auto_compress(character_name)

    def _check_auto_compress(self, character_name: str):
        config = self.config_manager.config.memory
        if not config.auto_compress:
            return
        memory = self.get_memory(character_name)
        if not memory:
            return
        if len(memory.messages) >= config.trigger_threshold:
            self.compress_memory(character_name, config.compress_count)

    async def compress_memory(
        self,
        character_name: str,
        keep_recent: Optional[int] = None,
    ) -> Dict[str, Any]:
        config = self.config_manager.config.memory
        memory = self.get_memory(character_name)
        if not memory:
            return {
                "success": False,
                "message": f"Memory not found for character: {character_name}",
                "compressed_count": 0,
                "summary": None,
            }

        keep_count = keep_recent or config.compress_count
        original_count = len(memory.messages)

        if original_count <= keep_count:
            return {
                "success": True,
                "message": "No need to compress",
                "compressed_count": 0,
                "summary": None,
            }

        if config.backup_before_compress:
            self._backup_memory(character_name)

        recent_messages = memory.messages[-keep_count:]
        old_messages = memory.messages[:-keep_count]

        summary = await self._generate_summary(
            character_name,
            old_messages,
            config.compress_prompt,
        )

        memory.messages = recent_messages
        memory.compressed_summary = summary
        memory.last_updated = datetime.now()

        self._memories[character_name] = memory
        self._save_memory(memory)

        compressed_count = original_count - keep_count
        logger.info(f"Compressed memory for {character_name}: {compressed_count} messages")

        return {
            "success": True,
            "message": "Memory compressed successfully",
            "compressed_count": compressed_count,
            "summary": summary,
        }

    async def _generate_summary(
        self,
        character_name: str,
        messages: List[Message],
        prompt_template: str,
    ) -> str:
        prompt = prompt_template.format(
            character_name=character_name,
            player_name="Player",
            message_count=len(messages),
        )
        summary = f"Summary of {len(messages)} messages for {character_name}"
        return summary

    def _backup_memory(self, character_name: str):
        memory = self.get_memory(character_name)
        if not memory:
            return
        backup_path = self._get_memory_path(f"{character_name}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        data = {
            "character_name": memory.character_name,
            "messages": [msg.model_dump() for msg in memory.messages],
            "last_updated": memory.last_updated.isoformat(),
            "compressed_summary": memory.compressed_summary,
        }
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


_memory_service_instance: Optional[MemoryService] = None


def get_memory_service() -> MemoryService:
    global _memory_service_instance
    if _memory_service_instance is None:
        _memory_service_instance = MemoryService()
    return _memory_service_instance

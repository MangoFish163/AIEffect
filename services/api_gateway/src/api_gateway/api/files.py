from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import os
import platform
from pathlib import Path
from datetime import datetime
from ..models.schemas import BaseResponse, DirectoryBrowseResponse, DirectoryTreeNode, FileItem
from shared_core import get_logger

router = APIRouter(prefix="/api/files", tags=["files"])
logger = get_logger(__name__)


def _get_file_type(path: Path) -> str:
    if path.is_dir():
        return "directory"
    return "file"


def _get_file_size(path: Path) -> Optional[int]:
    if path.is_file():
        return path.stat().st_size
    return None


def _get_modified_at(path: Path) -> datetime:
    stat = path.stat()
    return datetime.fromtimestamp(stat.st_mtime)


@router.get("/browse", response_model=BaseResponse)
async def browse_directory(path: Optional[str] = Query(None)):
    try:
        if path is None:
            path = str(Path.home())
        target_path = Path(path).resolve()
        if not target_path.exists():
            raise HTTPException(status_code=404, detail="Directory not found")
        if not target_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")
        items = []
        try:
            for item in sorted(target_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                try:
                    items.append({
                        "name": item.name,
                        "type": _get_file_type(item),
                        "size": _get_file_size(item),
                        "modified_at": _get_modified_at(item),
                    })
                except (PermissionError, OSError):
                    continue
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
        parent_path = str(target_path.parent) if target_path.parent != target_path else None
        return BaseResponse(data={
            "current_path": str(target_path),
            "parent_path": parent_path,
            "items": items,
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error browsing directory: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drives", response_model=BaseResponse)
async def get_drives():
    try:
        drives = []
        if platform.system() == "Windows":
            import string
            from ctypes import windll
            bitmask = windll.kernel32.GetLogicalDrives()
            for letter in string.ascii_uppercase:
                if bitmask & 1:
                    drive_path = f"{letter}:\\"
                    try:
                        drive_type = windll.kernel32.GetDriveTypeW(drive_path)
                        type_names = {0: "未知", 1: "无效", 2: "可移动", 3: "固定", 4: "远程", 5: "光驱", 6: "内存盘"}
                        drive_info = {
                            "letter": letter,
                            "path": drive_path,
                            "type": type_names.get(drive_type, "未知"),
                            "name": f"{letter}: 驱动器"
                        }
                        drives.append(drive_info)
                    except:
                        pass
                bitmask >>= 1
        else:
            drives = [{"letter": "/", "path": "/", "type": "根目录", "name": "根目录"}]
        return BaseResponse(data={"drives": drives})
    except Exception as e:
        logger.error(f"Error getting drives: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tree", response_model=BaseResponse)
async def get_directory_tree(
    root_path: str = Query(...),
    max_depth: int = Query(3, ge=1, le=5),
):
    try:
        target_path = Path(root_path).resolve()
        if not target_path.exists():
            raise HTTPException(status_code=404, detail="Directory not found")
        if not target_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")
        def build_tree(path: Path, current_depth: int) -> dict:
            node = {
                "path": str(path),
                "name": path.name or str(path),
                "type": "directory",
                "children": [],
            }
            if current_depth >= max_depth:
                return node
            try:
                for item in sorted(path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                    if item.is_dir():
                        try:
                            child = build_tree(item, current_depth + 1)
                            node["children"].append(child)
                        except (PermissionError, OSError):
                            continue
            except PermissionError:
                pass
            return node
        tree = build_tree(target_path, 0)
        return BaseResponse(data=tree)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting directory tree: {e}")
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import os
import platform
from pathlib import Path
from datetime import datetime
from ..models.schemas import BaseResponse, DirectoryBrowseResponse, DirectoryTreeNode, FileItem
from ..core.logger import get_logger

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

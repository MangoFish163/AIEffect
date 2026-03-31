"""CURL 解析器模块

提供通用的 CURL 命令解析功能，支持提取 URL、请求方法、请求头和请求体等信息。
"""

import json
import re
from typing import Dict, Any, Optional


class CURLParser:
    def __init__(self, curl_text: str):
        """
        初始化：传入完整的 CURL 字符串，自动解析所有参数
        """
        self.curl_text = self._clean_curl_text(curl_text)
        self.url = ""
        self.method = "GET"  # 默认请求方式
        self.headers: Dict[str, str] = {}
        self.body: Dict[str, Any] = {}
        # 自动解析
        self._parse_url()
        self._parse_headers()
        self._parse_method()
        self._parse_body()

    def _clean_curl_text(self, text: str) -> str:
        """清理 CURL 文本：去除换行、反斜杠、多余空格"""
        text = text.replace("\\\n", "").replace("\n", " ").replace("\\", "")
        return re.sub(r'\s+', ' ', text).strip()

    def _parse_url(self):
        """提取 CURL 中的 URL（curl 后第一个不带 - 的字符串）"""
        pattern = r'curl\s+([^-\s]+)'
        match = re.search(pattern, self.curl_text)
        if match:
            self.url = match.group(1).strip('\'"')

    def _parse_headers(self):
        """提取所有 -H 请求头，转为字典"""
        pattern = r'-H\s+[\'"]?([^\'"]+)[\'"]?'
        headers_list = re.findall(pattern, self.curl_text)
        for h in headers_list:
            if ':' in h:
                key, value = h.split(':', 1)
                self.headers[key.strip()] = value.strip()

    def _parse_method(self):
        """提取请求方式：-X 优先，有 -d 则默认 POST"""
        # 优先提取 -X 指定的方法
        x_pattern = r'-X\s+(\w+)'
        x_match = re.search(x_pattern, self.curl_text)
        if x_match:
            self.method = x_match.group(1).upper()
        # 无 -X 但有 -d，自动设为 POST
        elif '-d' in self.curl_text or '--data' in self.curl_text:
            self.method = "POST"

    def _parse_body(self):
        """解析 -d 的 JSON 请求体，转为字典"""
        pattern = r'-d\s+[\'"]?([^\'"]+)[\'"]?'
        body_match = re.search(pattern, self.curl_text)
        if body_match:
            body_str = body_match.group(1).strip()
            try:
                self.body = json.loads(body_str)
            except json.JSONDecodeError:
                self.body = {}

    def _get_nested_value(self, data: Any, path_parts: list) -> Any:
        """递归获取嵌套值（支持对象.属性、数组[索引]）"""
        try:
            current = data
            for part in path_parts:
                # 处理数组索引：input[0] → key=input, index=0
                arr_match = re.match(r'(\w+)\[(\d+)\]', part)
                if arr_match:
                    key, idx = arr_match.groups()
                    current = current[key][int(idx)]
                else:
                    current = current[part]
            return current if current is not None else ""
        except (KeyError, IndexError, TypeError):
            return ""

    def get(self, filter_path: Optional[str] = None) -> Any:
        """
        核心查询方法：按路径获取值
        :param filter_path: 过滤路径，如 Header、Header.Authorization、Url、Body.model、Body.input[0].text
        :return: 对应值，不存在返回空字符串
        """
        if not filter_path:
            return {
                "url": self.url,
                "method": self.method,
                "headers": self.headers,
                "body": self.body
            }

        # 拆分路径（如 Header.Authorization → ['Header', 'Authorization']）
        parts = filter_path.split('.', 1)
        main_key = parts[0].lower()
        sub_path = parts[1] if len(parts) > 1 else ""

        # 匹配查询规则
        if main_key == "url":
            return self.url if self.url else ""
        elif main_key == "method":
            return self.method if self.method else ""
        elif main_key == "header":
            if not sub_path:
                return self.headers
            return self.headers.get(sub_path, "")
        elif main_key == "body":
            if not sub_path:
                return self.body
            sub_parts = sub_path.split('.')
            return self._get_nested_value(self.body, sub_parts)
        else:
            # 无效路径，返回空字符串
            return ""


def cURLGeneralSpecifications(filter_path: str, curl_text: str) -> Any:
    """
    通用 CURL 解析函数

    :param filter_path: 过滤路径（必填），支持以下格式：
        - "url" - 获取请求 URL
        - "method" - 获取请求方法
        - "header" - 获取所有请求头
        - "header.Authorization" - 获取指定请求头
        - "body" - 获取完整请求体
        - "body.model" - 获取请求体中的 model 字段
        - "body.input[0].text" - 获取嵌套字段（支持数组索引）
    :param curl_text: 完整的 CURL 字符串（必填）
    :return: 对应结果，不存在返回空字符串

    示例：
        >>> curl = 'curl -X POST https://api.example.com -H "Authorization: Bearer token" -d \'{"model":"gpt-4"}\''
        >>> cURLGeneralSpecifications("body.model", curl)
        'gpt-4'
    """
    parser = CURLParser(curl_text)
    return parser.get(filter_path)


def generate_standard_curl(data: Dict[str, Any]) -> str:
    """
    反向生成标准格式化的 CURL 命令

    遵循规范：
    - POST + JSON Body 自动省略 -X POST
    - 多行美观，直接可用
    - 中文不转义，直接正常显示
    - 任何异常情况下返回空字符串

    :param data: 请求数据字典，格式如下：
        {
            "url": "请求地址",
            "method": "GET/POST/PUT/DELETE",
            "headers": {"请求头键值对"},
            "body": {请求体字典} | None
        }
    :return: 标准格式化的 CURL 命令字符串，异常时返回空字符串

    示例：
        >>> data = {
        ...     "url": "https://api.example.com",
        ...     "method": "POST",
        ...     "headers": {"Authorization": "Bearer token", "Content-Type": "application/json"},
        ...     "body": {"model": "gpt-4", "message": "你好"}
        ... }
        >>> print(generate_standard_curl(data))
        curl https://api.example.com \
        -H "Authorization: Bearer token" \
        -H "Content-Type: application/json" \
        -d '{
            "model": "gpt-4",
            "message": "你好"
        }'
    """
    try:
        if not isinstance(data, dict):
            return ""

        url = data.get("url", "")
        if not isinstance(url, str):
            return ""
        url = url.strip()

        method = data.get("method", "GET")
        if not isinstance(method, str):
            method = "GET"
        method = method.strip().upper()

        headers = data.get("headers", {})
        if not isinstance(headers, dict):
            headers = {}

        body = data.get("body", {})
        if body is None:
            body = {}

        if not url:
            return ""

        curl_parts = [f"curl {url}"]

        for key, value in headers.items():
            if isinstance(key, str) and isinstance(value, str):
                curl_parts.append(f'-H "{key}: {value}"')

        has_body = bool(body) and isinstance(body, dict)
        if method != "POST" or not has_body:
            curl_parts[0] = f"curl -X {method} {url}"

        if has_body:
            json_body = json.dumps(body, ensure_ascii=False, indent=4)
            curl_parts.append(f"-d '{json_body}'")

        standard_curl = " \\\n".join(curl_parts)
        return standard_curl

    except Exception:
        return ""

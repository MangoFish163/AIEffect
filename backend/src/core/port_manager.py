import socket
from typing import Optional, Dict, Any


class PortManager:
    DEFAULT_PORTS = {
        'api': 8501,
        'ollama_proxy': 11434,
        'websocket': 8502,
        'subtitle': 8503,
        'tts': 8504,
        'log': 8505,
    }
    
    PORT_RANGE = (8500, 8600)
    
    @classmethod
    def is_port_available(cls, port: int) -> bool:
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return True
        except OSError:
            return False
    
    @classmethod
    def find_available_port(cls, preferred_port: int) -> int:
        if cls.is_port_available(preferred_port):
            return preferred_port
        
        for port in range(preferred_port + 1, cls.PORT_RANGE[1] + 1):
            if cls.is_port_available(port):
                return port
        
        raise RuntimeError(f"无法在范围 {cls.PORT_RANGE} 内找到可用端口")
    
    @classmethod
    def get_service_port(cls, service_name: str, config: Optional[Dict[str, Any]] = None) -> int:
        preferred = config.get(f'{service_name}_port') if config else None
        preferred = preferred or cls.DEFAULT_PORTS.get(service_name, 8500)
        return cls.find_available_port(preferred)
    
    @classmethod
    def get_all_ports(cls, config: Optional[Dict[str, Any]] = None) -> Dict[str, int]:
        ports = {}
        for service_name in cls.DEFAULT_PORTS:
            ports[service_name] = cls.get_service_port(service_name, config)
        return ports

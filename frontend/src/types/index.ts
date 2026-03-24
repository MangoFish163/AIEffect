export interface AppConfig {
  api: APIConfig;
  tts: TTSConfig;
  subtitle: SubtitleConfig;
  memory: MemoryConfig;
  ports: PortConfig;
  lan_enabled: boolean;
}

export interface APIConfig {
  provider: string;
  api_url: string;
  api_key: string;
  model_name: string;
}

export interface TTSConfig {
  enabled: boolean;
  engine: string;
  volume: number;
  auto_play: boolean;
}

export interface SubtitleConfig {
  font_color: string;
  background_color: string;
  opacity: number;
  font_size: number;
  typing_speed: number;
}

export interface MemoryConfig {
  save_dir: string;
  trigger_threshold: number;
  compress_count: number;
  check_frequency: number;
  auto_compress: boolean;
}

export interface PortConfig {
  api: number;
  ollama_proxy: number;
  websocket: number;
  subtitle: number;
  tts: number;
  log: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface CharacterMemory {
  character_name: string;
  messages: Message[];
  last_updated: Date;
  compressed_summary?: string;
}

export type PageType = 'control' | 'subtitle' | 'voice' | 'memory' | 'logs' | 'agents';

import { create } from 'zustand';
import { AppConfig, PageType } from '../types';

interface AppState {
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;
  
  config: AppConfig;
  setConfig: (config: Partial<AppConfig>) => void;
  resetConfig: () => void;
}

const defaultConfig: AppConfig = {
  api: {
    provider: 'custom',
    api_url: '',
    api_key: '',
    model_name: '',
  },
  tts: {
    enabled: true,
    engine: 'gpt_sovits',
    volume: 0.8,
    auto_play: true,
  },
  subtitle: {
    font_color: '#ffffff',
    background_color: '#0a0a0f',
    opacity: 0.9,
    font_size: 16,
    typing_speed: 30,
  },
  memory: {
    save_dir: './data/memories',
    trigger_threshold: 300,
    compress_count: 50,
    check_frequency: 30,
    auto_compress: false,
  },
  ports: {
    api: 8500,
    ollama_proxy: 8501,
    websocket: 8502,
    subtitle: 8503,
    tts: 8504,
    log: 8505,
  },
  lan_enabled: false,
};

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'control',
  setCurrentPage: (page) => set({ currentPage: page }),
  
  config: defaultConfig,
  setConfig: (newConfig) =>
    set((state) => ({ config: { ...state.config, ...newConfig } })),
  resetConfig: () => set({ config: defaultConfig }),
}));

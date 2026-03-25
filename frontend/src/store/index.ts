import { create } from 'zustand';
import { AppConfig, PageType, Character, CharacterFormData } from '../types';

interface AppState {
  currentPage: PageType;
  setCurrentPage: (page: PageType) => void;

  config: AppConfig;
  setConfig: (config: Partial<AppConfig>) => void;
  resetConfig: () => void;

  characters: Character[];
  addCharacter: (data: CharacterFormData) => void;
  updateCharacter: (id: string, data: Partial<CharacterFormData>) => void;
  deleteCharacter: (id: string) => void;
}

const defaultConfig: AppConfig = {
  api: {
    provider: 'deepseek',
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
    backup_before_compress: false,
  },
  ports: {
    api: 8501,
    ollama_proxy: 11434,
    websocket: 8502,
    subtitle: 8503,
    tts: 8504,
    log: 8505,
  },
  lan_enabled: false,
};

const defaultCharacters: Character[] = [
  {
    id: '1',
    name: '艾莉娅',
    saveId: 'a1b2c3d4e5f6',
    aiSoul: '温柔善良的精灵法师，拥有治愈能力',
    aiVoice: '温柔女声-1',
    tokenUsage: 15420,
    chatCount: 328,
    compressionEnabled: true,
    interactionOps: ['对话', '任务', '交易'],
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-03-20'),
  },
  {
    id: '2',
    name: '雷恩',
    saveId: 'f6e5d4c3b2a1',
    aiSoul: '勇敢的战士，忠诚可靠，擅长近战',
    aiVoice: '沉稳男声-2',
    tokenUsage: 8930,
    chatCount: 156,
    compressionEnabled: false,
    interactionOps: ['对话', '战斗', '训练'],
    createdAt: new Date('2024-02-10'),
    updatedAt: new Date('2024-03-18'),
  },
];

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'control',
  setCurrentPage: (page) => set({ currentPage: page }),

  config: defaultConfig,
  setConfig: (newConfig) =>
    set((state) => ({ config: { ...state.config, ...newConfig } })),
  resetConfig: () => set({ config: defaultConfig }),

  characters: defaultCharacters,
  addCharacter: (data) =>
    set((state) => ({
      characters: [
        ...state.characters,
        {
          ...data,
          id: Date.now().toString(),
          tokenUsage: 0,
          chatCount: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    })),
  updateCharacter: (id, data) =>
    set((state) => ({
      characters: state.characters.map((char) =>
        char.id === id
          ? { ...char, ...data, updatedAt: new Date() }
          : char
      ),
    })),
  deleteCharacter: (id) =>
    set((state) => ({
      characters: state.characters.filter((char) => char.id !== id),
    })),
}));

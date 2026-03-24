import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, MessageSquare, Bot, Terminal, Coffee, Server, Database, Shield, Cpu, Wifi, Settings, Send, Lamp, BookOpen, Monitor, Armchair, ToggleLeft, ToggleRight } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAppStore } from '../store';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 像素角色类型
interface PixelAgent {
  id: string;
  name: string;
  role: string;
  x: number;
  y: number;
  color: string;
  avatar: string;
  status: 'idle' | 'working' | 'talking' | 'moving';
  direction: 'up' | 'down' | 'left' | 'right';
  message?: string;
  messageTime?: number;
}

// 办公室物品类型
interface OfficeItem {
  id: string;
  type: 'desk' | 'computer' | 'plant' | 'coffee' | 'server' | 'sofa' | 'bookshelf' | 'whiteboard' | 'lamp' | 'chair' | 'table' | 'cabinet' | 'window' | 'picture';
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  variant?: number;
}

// 像素大小
const PIXEL_SIZE = 36;
const GRID_WIDTH = 16;
const GRID_HEIGHT = 12;

// 颜色配置 - 温暖的办公室色调
const COLORS = {
  // 地板
  floorWood: '#d4a574',
  floorWoodDark: '#b8935f',
  floorTile: '#e8e4dc',
  floorTileDark: '#d4cfc4',
  // 墙壁
  wall: '#f5ebe0',
  wallDark: '#e8ddd0',
  // 家具
  desk: '#8b6914',
  deskDark: '#6b4e0a',
  chair: '#4a5568',
  sofa: '#c4a35a',
  sofaDark: '#a08240',
  bookshelf: '#6b4423',
  // 科技
  computer: '#1a1a2e',
  screen: '#16213e',
  screenOn: '#0f3460',
  server: '#2d3748',
  serverLight: '#48bb78',
  // 装饰
  plant: '#2d5016',
  plantPot: '#8b4513',
  coffee: '#4a2c2a',
  whiteboard: '#ffffff',
  lamp: '#d69e2e',
  picture: '#e2e8f0',
};

// 预设Agent
const INITIAL_AGENTS: PixelAgent[] = [
  { id: '1', name: 'Jarvis', role: '值班SRE', x: 2, y: 3, color: '#e07a5f', avatar: '🤖', status: 'working', direction: 'down' },
  { id: '2', name: 'Monica', role: '开发', x: 2, y: 6, color: '#3d405b', avatar: '👩‍💻', status: 'idle', direction: 'down' },
  { id: '3', name: '🦞', role: '休息中', x: 7, y: 5, color: '#f4a261', avatar: '🦞', status: 'idle', direction: 'right' },
  { id: '4', name: 'Cat', role: '测试', x: 10, y: 2, color: '#81b29a', avatar: '🐱', status: 'working', direction: 'down' },
  { id: '5', name: 'Bug', role: '安全', x: 13, y: 3, color: '#f2cc8f', avatar: '🐛', status: 'idle', direction: 'left' },
];

// 办公室布局 - 参考新风格
const OFFICE_ITEMS: OfficeItem[] = [
  // 左侧工作区 - 两个办公桌
  { id: 'desk1', type: 'desk', x: 1, y: 2, width: 2, height: 2, label: 'SRE' },
  { id: 'chair1', type: 'chair', x: 2, y: 4, width: 1, height: 1 },
  { id: 'monitor1', type: 'computer', x: 1, y: 2, width: 1, height: 1 },
  
  { id: 'desk2', type: 'desk', x: 1, y: 5, width: 2, height: 2, label: 'Dev' },
  { id: 'chair2', type: 'chair', x: 2, y: 7, width: 1, height: 1 },
  { id: 'monitor2', type: 'computer', x: 1, y: 5, width: 1, height: 1 },
  
  // 右侧工作区
  { id: 'desk3', type: 'desk', x: 13, y: 2, width: 2, height: 2, label: 'Test' },
  { id: 'chair3', type: 'chair', x: 13, y: 4, width: 1, height: 1 },
  { id: 'monitor3', type: 'computer', x: 13, y: 2, width: 1, height: 1 },
  
  // 中央休息区
  { id: 'sofa', type: 'sofa', x: 6, y: 4, width: 3, height: 2, label: '休息区' },
  { id: 'table', type: 'table', x: 7, y: 6, width: 1, height: 1 },
  { id: 'coffee', type: 'coffee', x: 6, y: 7, width: 1, height: 1 },
  
  // 咖啡吧台区
  { id: 'cabinet1', type: 'cabinet', x: 5, y: 1, width: 1, height: 1 },
  { id: 'cabinet2', type: 'cabinet', x: 6, y: 1, width: 1, height: 1 },
  { id: 'cabinet3', type: 'cabinet', x: 7, y: 1, width: 1, height: 1 },
  { id: 'cabinet4', type: 'cabinet', x: 8, y: 1, width: 1, height: 1 },
  
  // 服务器区
  { id: 'server1', type: 'server', x: 10, y: 1, width: 2, height: 2, label: 'Server' },
  { id: 'server2', type: 'server', x: 12, y: 1, width: 2, height: 2, label: 'DB' },
  
  // 书架区
  { id: 'bookshelf', type: 'bookshelf', x: 14, y: 6, width: 2, height: 3 },
  
  // 白板
  { id: 'whiteboard', type: 'whiteboard', x: 0, y: 1, width: 1, height: 3, label: 'Board' },
  
  // 植物装饰
  { id: 'plant1', type: 'plant', x: 4, y: 1, width: 1, height: 1 },
  { id: 'plant2', type: 'plant', x: 9, y: 7, width: 1, height: 1 },
  { id: 'plant3', type: 'plant', x: 13, y: 9, width: 1, height: 1 },
  
  // 灯具
  { id: 'lamp1', type: 'lamp', x: 3, y: 3, width: 1, height: 1 },
  { id: 'lamp2', type: 'lamp', x: 3, y: 6, width: 1, height: 1 },
  
  // 窗户
  { id: 'window', type: 'window', x: 5, y: 0, width: 6, height: 1 },
  
  // 装饰画
  { id: 'picture', type: 'picture', x: 0, y: 5, width: 1, height: 1 },
];

export const AgentsOffice: React.FC = () => {
  const { setCurrentPage } = useAppStore();
  const [agents, setAgents] = useState<PixelAgent[]>(INITIAL_AGENTS);
  const [selectedAgent, setSelectedAgent] = useState<PixelAgent | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{agent: string, message: string, time: Date}[]>([]);
  const [isAutoRun, setIsAutoRun] = useState(true);
  const animationRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // 移动Agent
  const moveAgent = useCallback((agentId: string, newX: number, newY: number) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id !== agentId) return agent;
      
      let direction = agent.direction;
      if (newX > agent.x) direction = 'right';
      else if (newX < agent.x) direction = 'left';
      else if (newY > agent.y) direction = 'down';
      else if (newY < agent.y) direction = 'up';
      
      return { ...agent, x: newX, y: newY, direction, status: 'moving' as const };
    }));
    
    setTimeout(() => {
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, status: 'idle' as const } : agent
      ));
    }, 500);
  }, []);

  // 让Agent说话
  const agentSpeak = useCallback((agentId: string, message: string) => {
    setAgents(prev => prev.map(agent => 
      agent.id === agentId 
        ? { ...agent, message, messageTime: Date.now(), status: 'talking' as const }
        : agent
    ));
    
    const agentName = agents.find(a => a.id === agentId)?.name || '';
    setChatHistory(prev => [...prev, { agent: agentName, message, time: new Date() }]);
    
    setTimeout(() => {
      setAgents(prev => prev.map(agent => 
        agent.id === agentId ? { ...agent, message: undefined, status: 'idle' as const } : agent
      ));
    }, 3000);
  }, [agents]);

  // AI行为模拟
  const simulateAIBehavior = useCallback(() => {
    if (!isAutoRun) return;
    
    const now = Date.now();
    if (now - lastUpdateRef.current < 2000) return;
    lastUpdateRef.current = now;
    
    setAgents(prev => prev.map(agent => {
      const rand = Math.random();
      
      if (rand < 0.15 && agent.status === 'idle') {
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        const newX = Math.max(0, Math.min(GRID_WIDTH - 1, agent.x + dx));
        const newY = Math.max(0, Math.min(GRID_HEIGHT - 1, agent.y + dy));
        
        if (newX !== agent.x || newY !== agent.y) {
          let direction: 'up' | 'down' | 'left' | 'right' = agent.direction;
          if (newX > agent.x) direction = 'right';
          else if (newX < agent.x) direction = 'left';
          else if (newY > agent.y) direction = 'down';
          else if (newY < agent.y) direction = 'up';
          
          return { ...agent, x: newX, y: newY, direction, status: 'moving' };
        }
      }
      
      if (rand >= 0.15 && rand < 0.25 && agent.status === 'idle') {
        return { ...agent, status: 'working' };
      }
      
      if (rand >= 0.25 && rand < 0.3 && agent.status === 'working') {
        return { ...agent, status: 'idle' };
      }
      
      return agent;
    }));
  }, [isAutoRun]);

  useEffect(() => {
    const animate = () => {
      simulateAIBehavior();
      animationRef.current = requestAnimationFrame(animate);
    };
    
    if (isAutoRun) {
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAutoRun, simulateAIBehavior]);

  const handleSendMessage = () => {
    if (!chatInput.trim() || !selectedAgent) return;
    agentSpeak(selectedAgent.id, chatInput.trim());
    setChatInput('');
  };

  // 渲染地板
  const renderFloor = () => {
    const tiles = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        // 左侧工作区用木地板，其他用瓷砖
        const isWoodArea = x < 5 && y < 9;
        const isRestArea = x >= 5 && x <= 9 && y >= 3 && y <= 8;
        
        let bgColor = COLORS.floorTile;
        if (isWoodArea) bgColor = (x + y) % 2 === 0 ? COLORS.floorWood : COLORS.floorWoodDark;
        else if (isRestArea) bgColor = (x + y) % 2 === 0 ? '#e8ddd0' : '#ddd0c0';
        
        tiles.push(
          <div
            key={`floor-${x}-${y}`}
            className="absolute"
            style={{
              left: x * PIXEL_SIZE,
              top: y * PIXEL_SIZE,
              width: PIXEL_SIZE,
              height: PIXEL_SIZE,
              backgroundColor: bgColor,
            }}
          />
        );
      }
    }
    return tiles;
  };

  // 渲染物品
  const renderItem = (item: OfficeItem) => {
    const style = {
      left: item.x * PIXEL_SIZE,
      top: item.y * PIXEL_SIZE,
      width: item.width * PIXEL_SIZE,
      height: item.height * PIXEL_SIZE,
    };

    switch (item.type) {
      case 'desk':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full bg-[#8b6914] rounded shadow-md border-2 border-[#6b4e0a] flex flex-col">
              <div className="h-2 bg-[#a08060] rounded-t" />
              <div className="flex-1 flex items-end justify-center pb-1">
                <span className="text-[8px] text-white/70 font-medium">{item.label}</span>
              </div>
            </div>
          </div>
        );
      case 'chair':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 bg-[#4a5568] rounded-md shadow-md flex items-center justify-center">
                <span className="text-xs">💺</span>
              </div>
            </div>
          </div>
        );
      case 'computer':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full flex items-start justify-center pt-1">
              <div className="w-5 h-4 bg-[#1a1a2e] rounded-sm shadow-lg border border-[#2d3748]">
                <div className="w-4 h-2.5 bg-[#0f3460] m-0.5 rounded-sm animate-pulse">
                  <div className="w-full h-full bg-gradient-to-b from-[#48bb78]/30 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        );
      case 'sofa':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full bg-[#c4a35a] rounded-lg shadow-lg border-2 border-[#a08240] flex items-center justify-center">
              <span className="text-2xl">🛋️</span>
            </div>
          </div>
        );
      case 'table':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-5 bg-[#8b6914] rounded-sm shadow-md">
                <div className="w-full h-1 bg-[#a08060] rounded-t-sm" />
              </div>
            </div>
          </div>
        );
      case 'coffee':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full flex items-center justify-center">
              <div className="relative">
                <div className="w-4 h-5 bg-[#4a2c2a] rounded-b-lg rounded-t-sm">
                  <div className="absolute top-0 left-1 w-2 h-1 bg-[#6b4423] rounded-full" />
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <span className="text-xs">☕</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 'cabinet':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full bg-[#6b4423] rounded-sm shadow-md border border-[#5a3a1d]">
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-4 h-0.5 bg-[#8b6914] rounded-full" />
              </div>
            </div>
          </div>
        );
      case 'server':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full bg-[#2d3748] rounded-sm shadow-lg border-2 border-[#1a202c] p-1">
              <div className="grid grid-cols-2 gap-1">
                <div className="w-2 h-2 bg-[#48bb78] rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-[#4299e1] rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-[#ed8936] rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                <div className="w-2 h-2 bg-[#e53e3e] rounded-full animate-pulse" style={{ animationDelay: '0.6s' }} />
              </div>
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                <span className="text-[6px] text-white/50">{item.label}</span>
              </div>
            </div>
          </div>
        );
      case 'bookshelf':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full bg-[#6b4423] rounded-sm shadow-md p-1">
              <div className="grid grid-cols-2 gap-0.5 h-full">
                <div className="bg-[#e53e3e] rounded-sm" />
                <div className="bg-[#4299e1] rounded-sm" />
                <div className="bg-[#48bb78] rounded-sm" />
                <div className="bg-[#ed8936] rounded-sm" />
                <div className="bg-[#9f7aea] rounded-sm" />
                <div className="bg-[#38b2ac] rounded-sm" />
              </div>
            </div>
          </div>
        );
      case 'whiteboard':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full bg-white rounded-sm shadow-md border-2 border-[#cbd5e0] flex flex-col">
              <div className="flex-1 p-1">
                <div className="w-full h-full flex flex-col gap-0.5">
                  <div className="h-1 bg-[#e53e3e] rounded-full" />
                  <div className="h-1 bg-[#4299e1] rounded-full w-3/4" />
                  <div className="h-1 bg-[#48bb78] rounded-full w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-[#e2e8f0] flex items-center justify-center">
                <span className="text-[6px] text-[#4a5568]">{item.label}</span>
              </div>
            </div>
          </div>
        );
      case 'plant':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full flex items-end justify-center">
              <div className="relative">
                <div className="w-5 h-5 bg-[#2d5016] rounded-full flex items-center justify-center">
                  <span className="text-sm">🌿</span>
                </div>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-3 bg-[#8b4513] rounded-sm" />
              </div>
            </div>
          </div>
        );
      case 'lamp':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full flex items-center justify-center">
              <div className="relative">
                <div className="w-1 h-4 bg-[#4a5568] rounded-full" />
                <div className="absolute -top-1 -left-2 w-5 h-3 bg-[#d69e2e] rounded-t-lg shadow-lg">
                  <div className="absolute inset-0 bg-yellow-200/50 rounded-t-lg animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        );
      case 'window':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full bg-[#87ceeb] rounded-sm border-2 border-[#e2e8f0] flex">
              <div className="flex-1 border-r border-[#e2e8f0]" />
              <div className="flex-1 border-r border-[#e2e8f0]" />
              <div className="flex-1 border-r border-[#e2e8f0]" />
              <div className="flex-1 border-r border-[#e2e8f0]" />
              <div className="flex-1 border-r border-[#e2e8f0]" />
              <div className="flex-1" />
            </div>
          </div>
        );
      case 'picture':
        return (
          <div key={item.id} style={style} className="absolute">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 bg-[#e2e8f0] rounded-sm border-2 border-[#cbd5e0] flex items-center justify-center">
                <span className="text-xs">🖼️</span>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // 渲染Agent
  const renderAgent = (agent: PixelAgent) => {
    const style = {
      left: agent.x * PIXEL_SIZE,
      top: agent.y * PIXEL_SIZE,
      width: PIXEL_SIZE,
      height: PIXEL_SIZE,
    };

    return (
      <div
        key={agent.id}
        style={style}
        className={cn(
          "absolute cursor-pointer transition-all duration-300 z-10",
          selectedAgent?.id === agent.id && "z-20"
        )}
        onClick={() => setSelectedAgent(agent)}
      >
        <div className="relative w-full h-full flex items-center justify-center">
          {/* 状态指示器 */}
          <div className={cn(
            "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm",
            agent.status === 'working' && "bg-[#4299e1] animate-pulse",
            agent.status === 'talking' && "bg-[#48bb78] animate-bounce",
            agent.status === 'moving' && "bg-[#ed8936]",
            agent.status === 'idle' && "bg-[#a0aec0]"
          )} />
          
          {/* 角色 */}
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xl shadow-lg transition-transform duration-200 border-2 border-white/50"
            style={{ 
              backgroundColor: agent.color,
              transform: agent.direction === 'left' ? 'scaleX(-1)' : 
                        agent.direction === 'up' ? 'scaleY(-1)' : 'none'
            }}
          >
            {agent.avatar}
          </div>
          
          {/* 名字标签 */}
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[10px] font-bold text-[#2d3748] bg-white/90 px-2 py-0.5 rounded-full shadow-md border border-[#e2e8f0]">
              {agent.name}
            </span>
          </div>
          
          {/* 对话气泡 */}
          {agent.message && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30">
              <div className="bg-white rounded-xl px-3 py-2 shadow-xl border-2 border-[#e2e8f0] max-w-[160px]">
                <p className="text-xs text-[#2d3748] font-medium">{agent.message}</p>
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-[#e2e8f0] rotate-45" />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex bg-[#f7fafc]">
      {/* 主游戏区域 */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#2d3748] flex items-center gap-3">
            <div className="w-10 h-10 bg-[#c4a35a] rounded-xl flex items-center justify-center shadow-md">
              <Users className="w-5 h-5 text-white" />
            </div>
            Agents办公室
          </h1>
          <p className="text-sm text-[#718096] mt-2 ml-13">
            温馨的像素风格协作空间 - 观察你的Agents一起工作
          </p>
        </div>

        {/* 控制栏 */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => setIsAutoRun(!isAutoRun)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm",
              isAutoRun
                ? "bg-[#48bb78] text-white hover:bg-[#38a169]"
                : "bg-white text-[#718096] border border-[#e2e8f0] hover:bg-[#f7fafc]"
            )}
          >
            <Bot className="w-4 h-4" />
            {isAutoRun ? 'AI运行中' : 'AI已暂停'}
          </button>

          <div className="flex items-center gap-3 text-sm bg-white px-4 py-2 rounded-xl border border-[#e2e8f0] shadow-sm">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#4299e1] rounded-full" />
              <span className="text-[#4a5568]">工作中</span>
            </span>
            <span className="w-px h-4 bg-[#e2e8f0]" />
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#48bb78] rounded-full" />
              <span className="text-[#4a5568]">对话中</span>
            </span>
            <span className="w-px h-4 bg-[#e2e8f0]" />
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#ed8936] rounded-full" />
              <span className="text-[#4a5568]">移动中</span>
            </span>
          </div>

        </div>

        {/* 像素办公室场景 */}
        <div 
          className="relative rounded-2xl shadow-2xl overflow-hidden border-4 border-[#e2e8f0]"
          style={{
            width: GRID_WIDTH * PIXEL_SIZE + 8,
            height: GRID_HEIGHT * PIXEL_SIZE + 8,
            backgroundColor: COLORS.wall,
          }}
        >
          {/* 地板 */}
          {renderFloor()}
          
          {/* 办公室物品 */}
          {OFFICE_ITEMS.map(renderItem)}
          
          {/* Agents */}
          {agents.map(renderAgent)}
          
          {/* 装饰边框 */}
          <div className="absolute inset-0 pointer-events-none border-4 border-[#e2e8f0]/50 rounded-2xl" />
        </div>

        {/* 说明 */}
        <div className="mt-6 flex gap-6 text-sm text-[#718096]">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-[#d4a574] rounded-lg flex items-center justify-center text-xs">🪵</span>
            <span>工作区</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-[#e8ddd0] rounded-lg flex items-center justify-center text-xs">☕</span>
            <span>休息区</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-[#2d3748] rounded-lg flex items-center justify-center text-xs">🖥️</span>
            <span>服务器</span>
          </div>
        </div>
      </div>

      {/* 右侧边栏 */}
      <div className="w-80 bg-white border-l border-[#e2e8f0] flex flex-col shadow-lg">
        {/* Agent详情 */}
        <div className="p-5 border-b border-[#e2e8f0]">
          <h3 className="font-bold text-[#2d3748] flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#c4a35a]" />
            Agent详情
          </h3>
          
          {selectedAgent ? (
            <div className="mt-4 p-4 bg-[#f7fafc] rounded-2xl border border-[#e2e8f0]">
              <div className="flex items-center gap-4">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-lg border-2 border-white"
                  style={{ backgroundColor: selectedAgent.color }}
                >
                  {selectedAgent.avatar}
                </div>
                <div>
                  <p className="font-bold text-[#2d3748] text-lg">{selectedAgent.name}</p>
                  <p className="text-xs text-[#718096]">{selectedAgent.role}</p>
                  <span className={cn(
                    "inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full",
                    selectedAgent.status === 'working' && "bg-[#bee3f8] text-[#2b6cb0]",
                    selectedAgent.status === 'talking' && "bg-[#c6f6d5] text-[#276749]",
                    selectedAgent.status === 'moving' && "bg-[#feebc8] text-[#c05621]",
                    selectedAgent.status === 'idle' && "bg-[#e2e8f0] text-[#4a5568]"
                  )}>
                    {selectedAgent.status === 'working' && '💼 工作中'}
                    {selectedAgent.status === 'talking' && '💬 对话中'}
                    {selectedAgent.status === 'moving' && '🚶 移动中'}
                    {selectedAgent.status === 'idle' && '☕ 空闲'}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2 mt-4">
                <button 
                  onClick={() => agentSpeak(selectedAgent.id, '收到指令！')}
                  className="flex-1 py-2 px-3 bg-[#c4a35a] text-white text-xs font-medium rounded-xl hover:bg-[#a08240] transition-colors shadow-sm"
                >
                  打招呼
                </button>
                <button 
                  onClick={() => {
                    const messages = ['正在处理...', '让我看看...', '收到！', '没问题！', '马上处理！'];
                    agentSpeak(selectedAgent.id, messages[Math.floor(Math.random() * messages.length)]);
                  }}
                  className="flex-1 py-2 px-3 bg-white text-[#718096] text-xs font-medium rounded-xl border border-[#e2e8f0] hover:bg-[#f7fafc] transition-colors"
                >
                  随机回复
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-6 bg-[#f7fafc] rounded-2xl text-center border border-[#e2e8f0]">
              <div className="w-12 h-12 bg-[#e2e8f0] rounded-xl flex items-center justify-center mx-auto mb-3">
                <Bot className="w-6 h-6 text-[#a0aec0]" />
              </div>
              <p className="text-sm text-[#a0aec0]">点击Agent查看详情</p>
            </div>
          )}
        </div>

        {/* 对话区域 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b border-[#e2e8f0] bg-[#f7fafc] shrink-0">
            <h3 className="font-bold text-[#2d3748] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#c4a35a]" />
              办公室广播
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {chatHistory.length === 0 ? (
              <div className="text-center text-[#a0aec0] text-sm py-10">
                <Coffee className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>还没有对话记录...</p>
              </div>
            ) : (
              chatHistory.slice(-20).map((chat, idx) => (
                <div key={idx} className="flex gap-3 p-3 bg-[#f7fafc] rounded-xl">
                  <span className="text-xs font-bold text-[#c4a35a] min-w-[50px]">
                    {chat.agent}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-[#4a5568]">{chat.message}</p>
                    <p className="text-[10px] text-[#a0aec0] mt-1">
                      {chat.time.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {selectedAgent && (
            <div className="p-4 border-t border-[#e2e8f0] shrink-0">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`对 ${selectedAgent.name} 说...`}
                  className="flex-1 px-4 py-2.5 text-sm border border-[#e2e8f0] rounded-xl focus:outline-none focus:border-[#c4a35a] focus:ring-2 focus:ring-[#c4a35a]/20 bg-[#f7fafc]"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                  className={cn(
                    "p-2.5 rounded-xl transition-colors",
                    chatInput.trim() 
                      ? "bg-[#c4a35a] text-white hover:bg-[#a08240]" 
                      : "bg-[#e2e8f0] text-[#a0aec0]"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 统计 */}
        <div className="p-5 border-t border-[#e2e8f0] bg-[#f7fafc]">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-[#e2e8f0]">
              <Server className="w-4 h-4 text-[#4299e1]" />
              <span className="text-xs text-[#4a5568] font-medium">{agents.filter(a => a.status === 'working').length} 工作中</span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-[#e2e8f0]">
              <Database className="w-4 h-4 text-[#48bb78]" />
              <span className="text-xs text-[#4a5568] font-medium">{chatHistory.length} 条对话</span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-[#e2e8f0]">
              <Shield className="w-4 h-4 text-[#9f7aea]" />
              <span className="text-xs text-[#4a5568] font-medium">{agents.length} 个Agent</span>
            </div>
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-[#e2e8f0]">
              <Cpu className="w-4 h-4 text-[#ed8936]" />
              <span className="text-xs text-[#4a5568] font-medium">AI运行中</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

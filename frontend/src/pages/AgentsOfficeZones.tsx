import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Users, MessageSquare, Bot, Terminal, Coffee, Send, BarChart3, Image as ImageIcon, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  color: number;
  avatar: string;
  status: 'idle' | 'working' | 'talking' | 'moving' | 'resting';
  direction: 'up' | 'down' | 'left' | 'right';
  zone: 'work' | 'rest' | 'lobby';
  message?: string;
  container?: Container;
  targetX?: number;
  targetY?: number;
}

// 办公室区域类型
interface Zone {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
}

// 交互物品类型
interface InteractiveItem {
  id: string;
  type: 'computer' | 'bookshelf' | 'music' | 'tv' | 'boss' | 'water' | 'stage' | 'mahjong' | 'board' | 'album' | 'plant' | 'lamp';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  description: string;
}

// 配置 - 更大的办公室
const PIXEL_SIZE = 28;
const GRID_WIDTH = 32;
const GRID_HEIGHT = 24;
const CANVAS_WIDTH = GRID_WIDTH * PIXEL_SIZE;
const CANVAS_HEIGHT = GRID_HEIGHT * PIXEL_SIZE;

// 温馨像素风配色 - 参考图2的暖色调
const COLORS = {
  // 地板 - 温暖的木质色调
  floorWork: 0xd4a574,   // 暖木色
  floorRest: 0xc9b896,   // 浅木色
  floorLobby: 0x8b7355,  // 深木色
  floorDark: 0xa08060,
  
  // 墙壁 - 米色温馨
  wall: 0xf5e6d3,
  wallDark: 0xe8d5c4,
  
  // 工作区
  desk: 0x6b4423,        // 深木桌
  computer: 0x2d3748,    // 电脑主机
  screenOn: 0x4ade80,    // 亮屏
  screenOff: 0x1a202c,   // 黑屏
  bookshelf: 0x5c4033,   // 书架
  bookColors: [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c],
  
  // 休息区
  sofa: 0xd4a574,
  stage: 0x8b5cf6,
  mahjong: 0x166534,
  water: 0x3b82f6,
  
  // 大厅
  lobby: 0xa8a29e,
  
  // 装饰
  plant: 0x22c55e,
  plantPot: 0xd97706,
  lamp: 0xfcd34d,
  lampBase: 0x4b5563,
  
  // 通用
  highlight: 0xf97316,
  shadow: 0x000000,
  white: 0xffffff,
  black: 0x1f2937,
};

// 办公室区域定义
const ZONES: Zone[] = [
  { id: 'work', name: '工作区', x: 0, y: 0, width: 20, height: 14, color: COLORS.floorWork },
  { id: 'rest', name: '休息区', x: 20, y: 0, width: 12, height: 14, color: COLORS.floorRest },
  { id: 'lobby', name: '大厅', x: 0, y: 14, width: 32, height: 10, color: COLORS.floorLobby },
];

// 交互物品
const INTERACTIVE_ITEMS: InteractiveItem[] = [
  // 工作区 - 日志管理（隔离电脑工位）
  { id: 'logs', type: 'computer', x: 2, y: 2, width: 4, height: 3, label: '日志管理', description: '查看系统运行日志' },
  
  // 工作区 - 记忆管理（两列图书柜）
  { id: 'memory', type: 'bookshelf', x: 7, y: 2, width: 5, height: 3, label: '记忆管理', description: '管理AI记忆数据' },
  
  // 工作区 - 语音配置（音乐台）
  { id: 'voice', type: 'music', x: 13, y: 2, width: 3, height: 3, label: '语音配置', description: '配置语音合成参数' },
  
  // 工作区 - 字幕视觉（大彩电）
  { id: 'subtitle', type: 'tv', x: 17, y: 2, width: 4, height: 3, label: '字幕视觉', description: '字幕显示设置' },
  
  // 工作区 - Boss巡查员（单独小房间）
  { id: 'boss', type: 'boss', x: 2, y: 7, width: 5, height: 5, label: 'Boss办公室', description: '管理员巡查' },
  
  // 工作区装饰
  { id: 'plant1', type: 'plant', x: 16, y: 7, width: 2, height: 2, label: '绿植', description: '净化空气' },
  { id: 'lamp1', type: 'lamp', x: 8, y: 7, width: 2, height: 3, label: '落地灯', description: '温馨照明' },
  
  // 休息区 - 饮水机
  { id: 'water', type: 'water', x: 22, y: 2, width: 2, height: 2, label: '饮水机', description: '休息饮水' },
  
  // 休息区 - 音乐舞台
  { id: 'stage', type: 'stage', x: 25, y: 2, width: 5, height: 4, label: '音乐舞台', description: 'AI表演舞台' },
  
  // 休息区 - 麻将牌桌
  { id: 'mahjong', type: 'mahjong', x: 22, y: 7, width: 4, height: 4, label: '麻将桌', description: '休闲娱乐' },
  
  // 休息区 - 支架看板（Token排行）
  { id: 'board', type: 'board', x: 27, y: 7, width: 3, height: 4, label: 'Token排行', description: '点击查看消耗排行' },
  
  // 休息区 - 相册
  { id: 'album', type: 'album', x: 22, y: 12, width: 3, height: 2, label: 'AI相册', description: '查看所有AI头像' },
  
  // 休息区装饰
  { id: 'plant2', type: 'plant', x: 26, y: 12, width: 2, height: 2, label: '盆栽', description: '装饰植物' },
];

// 预设Agents
const INITIAL_AGENTS: PixelAgent[] = [
  { id: '1', name: 'Jarvis', role: '日志专员', x: 4, y: 5, color: 0xe07a5f, avatar: '🤖', status: 'working', direction: 'down', zone: 'work' },
  { id: '2', name: 'Monica', role: '记忆管理员', x: 9, y: 5, color: 0x3d405b, avatar: '👩‍💻', status: 'working', direction: 'down', zone: 'work' },
  { id: '3', name: 'Voice', role: '语音调音师', x: 14, y: 5, color: 0x81b29a, avatar: '🎤', status: 'working', direction: 'down', zone: 'work' },
  { id: '4', name: 'Vision', role: '视觉设计师', x: 18, y: 5, color: 0xa855f7, avatar: '🎨', status: 'working', direction: 'down', zone: 'work' },
  { id: '5', name: 'Boss', role: '巡查员', x: 4, y: 10, color: 0xf59e0b, avatar: '👔', status: 'idle', direction: 'down', zone: 'work' },
  { id: '6', name: '🦞', role: '休息中', x: 24, y: 9, color: 0xf4a261, avatar: '🦞', status: 'resting', direction: 'right', zone: 'rest' },
  { id: '7', name: 'DJ', role: '舞台表演', x: 27, y: 5, color: 0xec4899, avatar: '🎧', status: 'resting', direction: 'left', zone: 'rest' },
  { id: '8', name: 'Player', role: '麻将高手', x: 24, y: 9, color: 0x22c55e, avatar: '🀄', status: 'resting', direction: 'right', zone: 'rest' },
  { id: '9', name: 'Waiter', role: '服务生', x: 23, y: 3, color: 0x3b82f6, avatar: '☕', status: 'resting', direction: 'down', zone: 'rest' },
  { id: '10', name: 'Newbie', role: '待命AI', x: 5, y: 17, color: 0x6b7280, avatar: '🆕', status: 'idle', direction: 'down', zone: 'lobby' },
  { id: '11', name: 'Trainee', role: '培训中', x: 12, y: 17, color: 0x6b7280, avatar: '📚', status: 'idle', direction: 'down', zone: 'lobby' },
  { id: '12', name: 'Intern', role: '实习生', x: 20, y: 17, color: 0x6b7280, avatar: '💼', status: 'idle', direction: 'down', zone: 'lobby' },
];

// Token消耗数据（模拟）
const TOKEN_RANKING = [
  { name: 'Jarvis', tokens: 15420, avatar: '🤖' },
  { name: 'Monica', tokens: 12350, avatar: '👩‍💻' },
  { name: 'Vision', tokens: 9870, avatar: '🎨' },
  { name: 'Voice', tokens: 8650, avatar: '🎤' },
  { name: 'Boss', tokens: 5420, avatar: '👔' },
];

export const AgentsOfficeZones: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initializedRef = useRef(false);
  const agentsRef = useRef<PixelAgent[]>(JSON.parse(JSON.stringify(INITIAL_AGENTS)));
  const [agents, setAgents] = useState<PixelAgent[]>(JSON.parse(JSON.stringify(INITIAL_AGENTS)));
  const [selectedAgent, setSelectedAgent] = useState<PixelAgent | null>(null);
  const [selectedItem, setSelectedItem] = useState<InteractiveItem | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{agent: string, message: string, time: Date}[]>([]);
  const [isAutoRun, setIsAutoRun] = useState(true);
  const [showTokenRanking, setShowTokenRanking] = useState(false);
  const [showAlbum, setShowAlbum] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const messageContainersRef = useRef<Map<string, Container>>(new Map());

  // 初始化 PixiJS
  useEffect(() => {
    if (initializedRef.current) return;
    if (!canvasRef.current) return;
    
    initializedRef.current = true;

    const initPixi = async () => {
      const app = new Application();
      await app.init({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: COLORS.wall,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      appRef.current = app;
      canvasRef.current?.appendChild(app.canvas);

      // 创建主容器
      const mainContainer = new Container();
      app.stage.addChild(mainContainer);

      // 绘制区域
      drawZones(mainContainer);
      
      // 绘制装饰（地板纹理）
      drawFloorDecorations(mainContainer);
      
      // 绘制交互物品
      drawInteractiveItems(mainContainer);
      
      // 创建Agents
      agentsRef.current.forEach(agent => {
        createAgent(mainContainer, agent);
      });

      // 启动动画
      app.ticker.add((ticker) => {
        updateAgents(ticker.deltaTime);
      });
    };

    initPixi();

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current.innerHTML = '';
      }
    };
  }, []);

  // 绘制地板装饰
  const drawFloorDecorations = (container: Container) => {
    const graphics = new Graphics();
    
    // 绘制木地板纹理线条
    ZONES.forEach(zone => {
      const px = zone.x * PIXEL_SIZE;
      const py = zone.y * PIXEL_SIZE;
      const w = zone.width * PIXEL_SIZE;
      const h = zone.height * PIXEL_SIZE;
      
      // 水平木纹线条
      for (let y = py + 10; y < py + h; y += 20) {
        graphics.rect(px, y, w, 1);
        graphics.fill(0x000000);
      }
    });
    
    graphics.alpha = 0.05;
    container.addChild(graphics);
  };

  // 绘制区域
  const drawZones = (container: Container) => {
    ZONES.forEach(zone => {
      const graphics = new Graphics();
      const px = zone.x * PIXEL_SIZE;
      const py = zone.y * PIXEL_SIZE;
      const w = zone.width * PIXEL_SIZE;
      const h = zone.height * PIXEL_SIZE;
      
      // 区域背景 - 带渐变效果
      graphics.rect(px, py, w, h);
      graphics.fill(zone.color);
      
      // 区域边框 - 深色木质边框
      graphics.rect(px, py, w, 4);
      graphics.rect(px, py + h - 4, w, 4);
      graphics.rect(px, py, 4, h);
      graphics.rect(px + w - 4, py, 4, h);
      graphics.fill(0x5c4033);
      
      container.addChild(graphics);

      // 区域标签 - 木质标牌风格
      const labelBg = new Graphics();
      labelBg.roundRect(px + 8, py + 8, 60, 24, 4);
      labelBg.fill(0x5c4033);
      labelBg.alpha = 0.9;
      container.addChild(labelBg);
      
      const label = new Text({
        text: zone.name,
        style: new TextStyle({
          fontSize: 12,
          fill: 0xffffff,
          fontWeight: 'bold',
        }),
      });
      label.x = px + 38 - label.width / 2;
      label.y = py + 14;
      container.addChild(label);
    });
  };

  // 绘制交互物品
  const drawInteractiveItems = (container: Container) => {
    INTERACTIVE_ITEMS.forEach(item => {
      const itemContainer = new Container();
      itemContainer.x = item.x * PIXEL_SIZE;
      itemContainer.y = item.y * PIXEL_SIZE;
      itemContainer.eventMode = 'static';
      itemContainer.cursor = 'pointer';

      const graphics = new Graphics();
      const w = item.width * PIXEL_SIZE;
      const h = item.height * PIXEL_SIZE;

      switch (item.type) {
        case 'computer':
          // 电脑工位 - 更精细
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(COLORS.desk);
          // 显示器
          graphics.rect(8, 4, w - 16, h - 14);
          graphics.fill(0x1a1a2e);
          graphics.rect(10, 6, w - 20, h - 18);
          graphics.fill(COLORS.screenOn);
          // 键盘
          graphics.rect(8, h - 10, w - 16, 6);
          graphics.fill(0x4a5568);
          break;
          
        case 'bookshelf':
          // 两列图书柜 - 更温馨
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(COLORS.bookshelf);
          // 书架隔板
          graphics.rect(4, h/3, w - 8, 2);
          graphics.rect(4, 2*h/3, w - 8, 2);
          graphics.fill(0x3d2914);
          // 书籍 - 更多颜色
          for (let i = 0; i < 8; i++) {
            const bx = 6 + (i % 4) * 12;
            const by = i < 4 ? 6 : h/3 + 4;
            graphics.rect(bx, by, 8, i < 4 ? h/3 - 6 : h/3 - 4);
            graphics.fill(COLORS.bookColors[i % COLORS.bookColors.length]);
          }
          break;
          
        case 'music':
          // 音乐台
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(0x2d3748);
          // 调音台
          graphics.rect(4, 4, w - 8, h - 8);
          graphics.fill(0x1a202c);
          // 旋钮
          graphics.circle(w/2, h/2 - 4, 4);
          graphics.fill(0xf472b6);
          graphics.circle(w/2 - 6, h/2 + 4, 3);
          graphics.circle(w/2 + 6, h/2 + 4, 3);
          graphics.fill(0x60a5fa);
          break;
          
        case 'tv':
          // 大彩电
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(0x1a1a2e);
          // 屏幕
          graphics.rect(4, 4, w - 8, h - 10);
          graphics.fill(0x000000);
          // 屏幕内容 - 模拟画面
          graphics.rect(6, 6, w - 12, 3);
          graphics.fill(0x4ade80);
          graphics.rect(6, 12, w - 16, 2);
          graphics.fill(0x60a5fa);
          graphics.rect(6, 18, w - 20, 2);
          graphics.fill(0xf472b6);
          break;
          
        case 'boss':
          // Boss办公室 - 更豪华
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(0xfcd34d);
          // 地毯
          graphics.rect(8, h - 20, w - 16, 14);
          graphics.fill(0xdc2626);
          // 写字台
          graphics.rect(8, 10, w - 16, 12);
          graphics.fill(COLORS.desk);
          // 椅子
          graphics.rect(w/2 - 6, 24, 12, 10);
          graphics.fill(0x1f2937);
          break;
          
        case 'water':
          // 饮水机
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(0xffffff);
          // 水桶
          graphics.rect(6, 4, w - 12, h - 10);
          graphics.fill(COLORS.water);
          // 水龙头
          graphics.rect(w/2 - 2, h - 8, 4, 4);
          graphics.fill(0x9ca3af);
          break;
          
        case 'stage':
          // 音乐舞台
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(COLORS.stage);
          // 舞台地板
          graphics.rect(6, 6, w - 12, h - 12);
          graphics.fill(0x5b21b6);
          // 聚光灯
          graphics.circle(w/2, 10, 6);
          graphics.fill(0xfcd34d);
          graphics.circle(w/2 - 8, 8, 4);
          graphics.circle(w/2 + 8, 8, 4);
          graphics.fill(0xfef3c7);
          break;
          
        case 'mahjong':
          // 麻将桌
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(COLORS.mahjong);
          // 桌面
          graphics.rect(6, 6, w - 12, h - 12);
          graphics.fill(0x15803d);
          // 麻将牌
          const positions = [[12, 12], [w-20, 12], [12, h-24], [w-20, h-24]];
          positions.forEach(([x, y]) => {
            graphics.rect(x, y, 8, 12);
            graphics.fill(0xffffff);
            graphics.rect(x+2, y+2, 4, 4);
            graphics.fill(0xdc2626);
          });
          break;
          
        case 'board':
          // 支架看板
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(0xffffff);
          // 白板
          graphics.rect(4, 4, w - 8, h - 8);
          graphics.fill(0xf3f4f6);
          // 排行榜柱状图
          graphics.rect(6, 8, w - 12, 6);
          graphics.fill(0xe53e3e);
          graphics.rect(6, 18, w - 16, 6);
          graphics.fill(0x4299e1);
          graphics.rect(6, 28, w - 20, 6);
          graphics.fill(0x48bb78);
          // 支架
          graphics.rect(w/2 - 2, h - 4, 4, 4);
          graphics.fill(0x4b5563);
          break;
          
        case 'album':
          // 相册
          graphics.rect(2, 2, w - 4, h - 4);
          graphics.fill(0xe2e8f0);
          // 相框
          graphics.rect(4, 4, w - 8, h - 8);
          graphics.fill(0xffffff);
          // 照片
          graphics.circle(w/2, h/2, 10);
          graphics.fill(0x6366f1);
          graphics.circle(w/2 - 3, h/2 - 3, 3);
          graphics.fill(0xffffff);
          break;
          
        case 'plant':
          // 绿植
          graphics.rect(w/2 - 6, h - 8, 12, 8);
          graphics.fill(COLORS.plantPot);
          // 叶子
          graphics.circle(w/2, h/2 - 4, 8);
          graphics.fill(COLORS.plant);
          graphics.circle(w/2 - 6, h/2, 6);
          graphics.circle(w/2 + 6, h/2, 6);
          graphics.fill(0x16a34a);
          break;
          
        case 'lamp':
          // 落地灯
          graphics.rect(w/2 - 2, h - 6, 4, 6);
          graphics.fill(COLORS.lampBase);
          // 灯罩
          graphics.rect(w/2 - 8, 4, 16, 12);
          graphics.fill(COLORS.lamp);
          // 灯杆
          graphics.rect(w/2 - 1, 16, 2, h - 22);
          graphics.fill(0x4b5563);
          break;
      }

      itemContainer.addChild(graphics);

      // 标签 - 木质风格
      const labelBg = new Graphics();
      labelBg.roundRect(0, h + 4, w, 16, 3);
      labelBg.fill(0x5c4033);
      labelBg.alpha = 0.8;
      itemContainer.addChild(labelBg);
      
      const label = new Text({
        text: item.label,
        style: new TextStyle({
          fontSize: 8,
          fill: 0xffffff,
          fontWeight: 'bold',
        }),
      });
      label.x = (w - label.width) / 2;
      label.y = h + 8;
      itemContainer.addChild(label);

      // 点击事件
      itemContainer.on('pointerdown', () => {
        setSelectedItem(item);
        setIsDrawerOpen(true);
        if (item.id === 'board') {
          setShowTokenRanking(true);
        } else if (item.id === 'album') {
          setShowAlbum(true);
        }
      });

      container.addChild(itemContainer);
    });
  };

  // 创建Agent
  const createAgent = (container: Container, agent: PixelAgent) => {
    const agentContainer = new Container();
    agentContainer.x = agent.x * PIXEL_SIZE + PIXEL_SIZE / 2;
    agentContainer.y = agent.y * PIXEL_SIZE + PIXEL_SIZE / 2;
    agentContainer.eventMode = 'static';
    agentContainer.cursor = 'pointer';

    // 阴影
    const shadow = new Graphics();
    shadow.ellipse(0, 12, 12, 5);
    shadow.fill(0x000000);
    shadow.alpha = 0.15;
    agentContainer.addChild(shadow);

    // 身体 - 更圆润
    const body = new Graphics();
    body.roundRect(-12, -12, 24, 24, 6);
    body.fill(agent.color);
    // 身体高光
    body.roundRect(-10, -10, 20, 10, 4);
    body.fill(0xffffff);
    body.alpha = 0.2;
    agentContainer.addChild(body);

    // 头像
    const avatar = new Text({
      text: agent.avatar,
      style: new TextStyle({ fontSize: 16 }),
    });
    avatar.anchor.set(0.5);
    agentContainer.addChild(avatar);

    // 名字背景 - 木质风格
    const nameBg = new Graphics();
    nameBg.roundRect(-28, 14, 56, 16, 8);
    nameBg.fill(0x5c4033);
    nameBg.alpha = 0.9;
    agentContainer.addChild(nameBg);

    // 名字
    const nameText = new Text({
      text: agent.name,
      style: new TextStyle({
        fontSize: 8,
        fill: 0xffffff,
        fontWeight: 'bold',
      }),
    });
    nameText.anchor.set(0.5);
    nameText.y = 22;
    agentContainer.addChild(nameText);

    // 状态点
    const statusDot = new Graphics();
    const statusColors = {
      working: 0x3b82f6,
      talking: 0x22c55e,
      moving: 0xf97316,
      idle: 0x9ca3af,
      resting: 0xf472b6,
    };
    statusDot.circle(10, -10, 5);
    statusDot.fill(statusColors[agent.status]);
    // 状态点边框
    statusDot.circle(10, -10, 5);
    statusDot.stroke({ width: 2, color: 0xffffff });
    agentContainer.addChild(statusDot);

    // 点击事件
    agentContainer.on('pointerdown', () => {
      setSelectedAgent(agent);
      setIsDrawerOpen(true);
    });

    container.addChild(agentContainer);
    agent.container = agentContainer;
  };

  // 更新Agents
  const updateAgents = (deltaTime: number) => {
    if (!isAutoRun) return;

    agentsRef.current.forEach(agent => {
      if (!agent.container) return;

      // 移动
      if (agent.targetX !== undefined && agent.targetY !== undefined) {
        const targetPx = agent.targetX * PIXEL_SIZE + PIXEL_SIZE / 2;
        const targetPy = agent.targetY * PIXEL_SIZE + PIXEL_SIZE / 2;
        
        const dx = targetPx - agent.container.x;
        const dy = targetPy - agent.container.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 2) {
          agent.x = agent.targetX;
          agent.y = agent.targetY;
          agent.targetX = undefined;
          agent.targetY = undefined;
          agent.status = agent.zone === 'rest' ? 'resting' : 'idle';
        } else {
          agent.container.x += (dx / distance) * 2 * deltaTime;
          agent.container.y += (dy / distance) * 2 * deltaTime;
        }
      }

      // 随机移动
      if (Math.random() < 0.002 && !agent.targetX) {
        const zone = ZONES.find(z => z.id === agent.zone);
        if (zone) {
          const newX = zone.x + Math.floor(Math.random() * (zone.width - 2)) + 1;
          const newY = zone.y + Math.floor(Math.random() * (zone.height - 2)) + 1;
          agent.targetX = newX;
          agent.targetY = newY;
          agent.status = 'moving';
        }
      }
    });

    setAgents([...agentsRef.current]);
  };

  // Agent说话
  const agentSpeak = useCallback((agentId: string, message: string) => {
    const agent = agentsRef.current.find(a => a.id === agentId);
    if (!agent || !agent.container) return;

    agent.message = message;
    agent.status = 'talking';
    
    setChatHistory(prev => [...prev, {
      agent: agent.name,
      message,
      time: new Date(),
    }]);

    // 显示消息
    const bubble = new Container();
    const text = new Text({
      text: message,
      style: new TextStyle({ fontSize: 11, fill: 0x1f2937 }),
    });
    const bg = new Graphics();
    bg.roundRect(0, 0, text.width + 16, text.height + 10, 8);
    bg.fill(0xfffbeb);
    bg.stroke({ width: 2, color: 0xfcd34d });
    text.x = 8;
    text.y = 5;
    bubble.addChild(bg, text);
    bubble.x = -bubble.width / 2;
    bubble.y = -45;
    agent.container.addChild(bubble);

    setTimeout(() => {
      agent.container?.removeChild(bubble);
      agent.message = undefined;
      agent.status = agent.zone === 'rest' ? 'resting' : 'idle';
    }, 3000);
  }, []);

  const handleSendMessage = () => {
    if (!chatInput.trim() || !selectedAgent) return;
    agentSpeak(selectedAgent.id, chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="h-full flex bg-[#f5e6d3] relative overflow-hidden">
      {/* 主游戏区域 */}
      <div className="flex-1 p-4 overflow-auto">
        {/* 标题栏 */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#5c4033] flex items-center gap-3">
              <div className="w-10 h-10 bg-[#d4a574] rounded-xl flex items-center justify-center shadow-md border-2 border-[#8b6914]">
                <Users className="w-5 h-5 text-white" />
              </div>
              <span className="text-[#5c4033]">Agents工作室</span>
            </h1>
            <p className="text-sm text-[#8b7355] mt-1">
              温馨像素办公室 - 点击Agent或物品互动
            </p>
          </div>
          
          {/* 打开抽屉按钮 */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#d4a574] text-white rounded-xl shadow-md hover:bg-[#c49464] transition-all border-2 border-[#8b6914]"
          >
            <Menu className="w-4 h-4" />
            详情
          </button>
        </div>

        {/* 控制栏 */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <button
            onClick={() => setIsAutoRun(!isAutoRun)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border-2",
              isAutoRun 
                ? "bg-[#22c55e] text-white border-[#16a34a]" 
                : "bg-white text-[#8b7355] border-[#d4a574]"
            )}
          >
            <Bot className="w-4 h-4" />
            {isAutoRun ? 'AI运行中' : 'AI已暂停'}
          </button>
          
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1.5 bg-[#d4a574] text-white rounded-lg border border-[#8b6914]">工作区</span>
            <span className="px-3 py-1.5 bg-[#c9b896] text-[#5c4033] rounded-lg border border-[#8b7355]">休息区</span>
            <span className="px-3 py-1.5 bg-[#8b7355] text-white rounded-lg border border-[#5c4033]">大厅</span>
          </div>
        </div>

        {/* PixiJS 画布 */}
        <div className="flex justify-center">
          <div 
            ref={canvasRef}
            className="rounded-2xl shadow-2xl overflow-hidden border-4 border-[#8b6914]"
          />
        </div>
      </div>

      {/* 抽屉式侧边栏 */}
      <div 
        className={cn(
          "fixed right-0 top-0 h-full bg-[#fffbeb] shadow-2xl transition-transform duration-300 z-40 flex flex-col border-l-4 border-[#d4a574]",
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{ width: '320px' }}
      >
        {/* 关闭按钮 */}
        <button
          onClick={() => setIsDrawerOpen(false)}
          className="absolute left-0 top-1/2 -translate-x-full bg-[#d4a574] text-white p-2 rounded-l-xl shadow-lg hover:bg-[#c49464] transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        
        {/* 抽屉头部 */}
        <div className="p-4 bg-[#d4a574] text-white">
          <h3 className="font-bold flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            {selectedItem ? '物品详情' : selectedAgent ? 'Agent详情' : '工作室控制台'}
          </h3>
        </div>
        
        {/* Agent/物品详情 */}
        <div className="p-4 border-b border-[#e8d5c4]">
          {selectedItem ? (
            <div className="p-4 bg-white rounded-xl border-2 border-[#d4a574] shadow-sm">
              <p className="font-bold text-[#5c4033] text-lg">{selectedItem.label}</p>
              <p className="text-sm text-[#8b7355] mt-2">{selectedItem.description}</p>
              {selectedItem.id === 'board' && (
                <button 
                  onClick={() => setShowTokenRanking(true)}
                  className="mt-3 w-full px-3 py-2 bg-[#d4a574] text-white text-sm rounded-lg hover:bg-[#c49464] transition-all border-2 border-[#8b6914]"
                >
                  查看Token排行
                </button>
              )}
              {selectedItem.id === 'album' && (
                <button 
                  onClick={() => setShowAlbum(true)}
                  className="mt-3 w-full px-3 py-2 bg-[#d4a574] text-white text-sm rounded-lg hover:bg-[#c49464] transition-all border-2 border-[#8b6914]"
                >
                  打开AI相册
                </button>
              )}
            </div>
          ) : selectedAgent ? (
            <div className="p-4 bg-white rounded-xl border-2 border-[#d4a574] shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl border-2 border-[#d4a574]"
                  style={{ backgroundColor: `#${selectedAgent.color.toString(16).padStart(6, '0')}` }}>
                  {selectedAgent.avatar}
                </div>
                <div>
                  <p className="font-bold text-[#5c4033]">{selectedAgent.name}</p>
                  <p className="text-sm text-[#8b7355]">{selectedAgent.role}</p>
                  <span className="text-xs px-2 py-0.5 bg-[#f5e6d3] text-[#5c4033] rounded-full border border-[#d4a574]">
                    {selectedAgent.zone === 'work' ? '工作区' : selectedAgent.zone === 'rest' ? '休息区' : '大厅'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-[#8b7355]">
              <div className="w-16 h-16 mx-auto mb-3 bg-[#f5e6d3] rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-[#d4a574]" />
              </div>
              <p className="text-sm">点击Agent或物品查看详情</p>
            </div>
          )}
        </div>

        {/* 对话区域 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-3 bg-[#f5e6d3] border-b border-[#e8d5c4]">
            <h3 className="font-bold text-[#5c4033] flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#d4a574]" />
              办公室广播
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
            {chatHistory.length === 0 ? (
              <div className="text-center text-[#8b7355] text-sm py-8">
                <Coffee className="w-10 h-10 mx-auto mb-2 text-[#d4a574]" />
                <p>还没有对话...</p>
                <p className="text-xs mt-1">选择Agent开始聊天</p>
              </div>
            ) : (
              chatHistory.slice(-20).map((chat, idx) => (
                <div key={idx} className="flex gap-2 p-3 bg-white rounded-lg text-sm border border-[#e8d5c4]">
                  <span className="font-bold text-[#d4a574]">{chat.agent}</span>
                  <span className="text-[#5c4033]">{chat.message}</span>
                </div>
              ))
            )}
          </div>
          
          {selectedAgent && (
            <div className="p-3 border-t border-[#e8d5c4] bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={`对 ${selectedAgent.name} 说...`}
                  className="flex-1 px-3 py-2 text-sm border-2 border-[#e8d5c4] rounded-lg focus:outline-none focus:border-[#d4a574] bg-[#fffbeb]"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    chatInput.trim() 
                      ? "bg-[#d4a574] text-white hover:bg-[#c49464]" 
                      : "bg-[#e8d5c4] text-[#a08060]"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 遮罩层 */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Token排行弹窗 */}
      {showTokenRanking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#fffbeb] rounded-2xl p-6 w-96 shadow-2xl border-4 border-[#d4a574]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-[#5c4033]">
                <BarChart3 className="w-5 h-5 text-[#d4a574]" />
                Token消耗排行
              </h3>
              <button onClick={() => setShowTokenRanking(false)} className="text-[#8b7355] hover:text-[#5c4033]">✕</button>
            </div>
            <div className="space-y-3">
              {TOKEN_RANKING.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-white rounded-xl border-2 border-[#e8d5c4]">
                  <span className="text-2xl">{item.avatar}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-[#5c4033]">{item.name}</p>
                    <div className="w-full bg-[#e8d5c4] rounded-full h-2.5 mt-1">
                      <div 
                        className="bg-[#d4a574] h-2.5 rounded-full"
                        style={{ width: `${(item.tokens / 15420) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#d4a574]">{item.tokens.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* AI相册弹窗 */}
      {showAlbum && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#fffbeb] rounded-2xl p-6 w-96 shadow-2xl max-h-[80vh] overflow-auto border-4 border-[#d4a574]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-[#5c4033]">
                <ImageIcon className="w-5 h-5 text-[#d4a574]" />
                AI相册
              </h3>
              <button onClick={() => setShowAlbum(false)} className="text-[#8b7355] hover:text-[#5c4033]">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {agents.map((agent) => (
                <div key={agent.id} className="p-3 bg-white rounded-xl text-center border-2 border-[#e8d5c4] hover:border-[#d4a574] transition-all cursor-pointer">
                  <div className="text-3xl mb-1">{agent.avatar}</div>
                  <p className="text-xs font-semibold text-[#5c4033]">{agent.name}</p>
                  <p className="text-[10px] text-[#8b7355]">{agent.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

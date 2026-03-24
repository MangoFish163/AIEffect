import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle, Ticker, BlurFilter } from 'pixi.js';
import { Users, MessageSquare, Bot, Terminal, Coffee, Server, Database, Shield, Cpu, Send } from 'lucide-react';
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
  status: 'idle' | 'working' | 'talking' | 'moving';
  direction: 'up' | 'down' | 'left' | 'right';
  message?: string;
  messageTime?: number;
  container?: Container;
  targetX?: number;
  targetY?: number;
  walkCycle?: number;
  isDragging?: boolean;
}

// 粒子类型
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  graphics: Graphics;
}

// 配置
const PIXEL_SIZE = 32;
const GRID_WIDTH = 16;
const GRID_HEIGHT = 12;
const CANVAS_WIDTH = GRID_WIDTH * PIXEL_SIZE;
const CANVAS_HEIGHT = GRID_HEIGHT * PIXEL_SIZE;

// 颜色配置 - 温暖的办公室色调
const COLORS = {
  floorWood: 0xd4a574,
  floorWoodDark: 0xb8935f,
  floorTile: 0xe8e4dc,
  floorTileDark: 0xd4cfc4,
  wall: 0xf5ebe0,
  wallDark: 0xe8ddd0,
  desk: 0x8b6914,
  deskDark: 0x6b4e0a,
  deskTop: 0xa08060,
  chair: 0x4a5568,
  chairDark: 0x2d3748,
  sofa: 0xc4a35a,
  sofaDark: 0xa08240,
  bookshelf: 0x6b4423,
  computer: 0x1a1a2e,
  screenOn: 0x48bb78,
  screenGlow: 0x4ade80,
  server: 0x2d3748,
  serverLight: 0x3b82f6,
  plant: 0x2d5016,
  plantPot: 0x8b4513,
  coffee: 0x4a2c2a,
  whiteboard: 0xffffff,
  lamp: 0xd69e2e,
  lampGlow: 0xfcd34d,
  window: 0x87ceeb,
  shadow: 0x000000,
};

// 预设Agent
const INITIAL_AGENTS: PixelAgent[] = [
  { id: '1', name: 'Jarvis', role: '值班SRE', x: 2, y: 3, color: 0xe07a5f, avatar: '🤖', status: 'working', direction: 'down', walkCycle: 0 },
  { id: '2', name: 'Monica', role: '开发', x: 2, y: 6, color: 0x3d405b, avatar: '👩‍💻', status: 'idle', direction: 'down', walkCycle: 0 },
  { id: '3', name: '🦞', role: '休息中', x: 7, y: 5, color: 0xf4a261, avatar: '🦞', status: 'idle', direction: 'right', walkCycle: 0 },
  { id: '4', name: 'Cat', role: '测试', x: 10, y: 2, color: 0x81b29a, avatar: '🐱', status: 'working', direction: 'down', walkCycle: 0 },
  { id: '5', name: 'Bug', role: '安全', x: 13, y: 3, color: 0xf2cc8f, avatar: '🐛', status: 'idle', direction: 'left', walkCycle: 0 },
];

export const AgentsOfficeAdvanced: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const initializedRef = useRef(false);
  const agentsRef = useRef<PixelAgent[]>(JSON.parse(JSON.stringify(INITIAL_AGENTS)));
  const [agents, setAgents] = useState<PixelAgent[]>(JSON.parse(JSON.stringify(INITIAL_AGENTS)));
  const [selectedAgent, setSelectedAgent] = useState<PixelAgent | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{agent: string, message: string, time: Date}[]>([]);
  const [isAutoRun, setIsAutoRun] = useState(true);
  const messageContainersRef = useRef<Map<string, Container>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const lightsRef = useRef<Container[]>([]);
  const shadowsRef = useRef<Container[]>([]);
  const selectedAgentRef = useRef<PixelAgent | null>(null);
  const dragRef = useRef<{ agent: PixelAgent | null, offsetX: number, offsetY: number }>({ agent: null, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    selectedAgentRef.current = selectedAgent;
  }, [selectedAgent]);

  // 初始化 PixiJS
  useEffect(() => {
    // 防止重复初始化
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

      // 创建场景容器
      const sceneContainer = new Container();
      app.stage.addChild(sceneContainer);

      // 创建阴影层
      const shadowLayer = new Container();
      sceneContainer.addChild(shadowLayer);

      // 创建地板层
      const floorLayer = new Container();
      sceneContainer.addChild(floorLayer);

      // 创建家具层
      const furnitureLayer = new Container();
      sceneContainer.addChild(furnitureLayer);

      // 创建光照层
      const lightLayer = new Container();
      sceneContainer.addChild(lightLayer);

      // 创建角色层
      const agentLayer = new Container();
      sceneContainer.addChild(agentLayer);

      // 创建粒子层
      const particleLayer = new Container();
      sceneContainer.addChild(particleLayer);

      // 创建UI层
      const uiLayer = new Container();
      sceneContainer.addChild(uiLayer);

      // 绘制地板（带纹理）
      drawFloorWithTexture(floorLayer);

      // 绘制墙壁装饰
      drawWalls(furnitureLayer);

      // 绘制办公室物品（精细化）
      drawDetailedOffice(furnitureLayer, lightLayer);

      // 创建Agents
      agentsRef.current.forEach(agent => {
        createDetailedAgent(agentLayer, shadowLayer, agent);
      });

      // 启动动画循环
      app.ticker.add((ticker) => {
        updateAgents(ticker.deltaTime);
        updateParticles(ticker.deltaTime);
        updateLights(ticker.deltaTime);
        updateAnimations(ticker.deltaTime);
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

  // 绘制带纹理的地板
  const drawFloorWithTexture = (container: Container) => {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const isWoodArea = x < 5 && y < 9;
        const isRestArea = x >= 5 && x <= 9 && y >= 3 && y <= 8;
        
        let baseColor = COLORS.floorTile;
        if (isWoodArea) baseColor = (x + y) % 2 === 0 ? COLORS.floorWood : COLORS.floorWoodDark;
        else if (isRestArea) baseColor = (x + y) % 2 === 0 ? 0xe8ddd0 : 0xddd0c0;

        const floor = new Graphics();
        const px = x * PIXEL_SIZE;
        const py = y * PIXEL_SIZE;
        
        // 基础地板
        floor.rect(px, py, PIXEL_SIZE, PIXEL_SIZE);
        floor.fill(baseColor);
        
        // 添加纹理细节
        if (isWoodArea) {
          // 木纹效果
          floor.rect(px + 2, py + 4, PIXEL_SIZE - 4, 1);
          floor.fill(0x000000);
          floor.alpha = 0.05;
        }
        
        container.addChild(floor);
      }
    }
  };

  // 绘制墙壁
  const drawWalls = (container: Container) => {
    // 窗户
    const window = new Graphics();
    for (let i = 0; i < 6; i++) {
      const px = (5 + i) * PIXEL_SIZE;
      // 窗框
      window.rect(px, 0, PIXEL_SIZE, PIXEL_SIZE);
      window.fill(COLORS.window);
      // 窗格
      window.rect(px + 2, 2, PIXEL_SIZE - 4, PIXEL_SIZE - 4);
      window.fill(0xffffff);
      window.rect(px + 4, 4, PIXEL_SIZE - 8, PIXEL_SIZE - 8);
      window.fill(COLORS.window);
    }
    container.addChild(window);

    // 白板
    const whiteboard = new Graphics();
    whiteboard.rect(2, PIXEL_SIZE, 28, PIXEL_SIZE * 3);
    whiteboard.fill(COLORS.whiteboard);
    whiteboard.rect(2, PIXEL_SIZE, 28, 2);
    whiteboard.fill(0xcccccc);
    // 白板内容
    whiteboard.rect(6, PIXEL_SIZE + 8, 20, 2);
    whiteboard.fill(0xe53e3e);
    whiteboard.rect(6, PIXEL_SIZE + 14, 15, 2);
    whiteboard.fill(0x4299e1);
    whiteboard.rect(6, PIXEL_SIZE + 20, 12, 2);
    whiteboard.fill(0x48bb78);
    container.addChild(whiteboard);
  };

  // 绘制精细办公室
  const drawDetailedOffice = (container: Container, lightLayer: Container) => {
    // 左侧工作区 - 精细办公桌1
    drawDetailedDesk(container, 1, 2, 'SRE');
    drawDetailedComputer(container, lightLayer, 1, 2);
    drawDetailedChair(container, 2, 4);

    // 办公桌2
    drawDetailedDesk(container, 1, 5, 'Dev');
    drawDetailedComputer(container, lightLayer, 1, 5);
    drawDetailedChair(container, 2, 7);

    // 右侧工作区
    drawDetailedDesk(container, 13, 2, 'Test');
    drawDetailedComputer(container, lightLayer, 13, 2);
    drawDetailedChair(container, 13, 4);

    // 中央休息区
    drawDetailedSofa(container, 6, 4);
    drawDetailedTable(container, 7, 6);
    drawDetailedCoffee(container, 6, 7);

    // 咖啡吧台
    for (let i = 0; i < 4; i++) {
      drawDetailedCabinet(container, 5 + i, 1);
    }

    // 服务器（带灯光效果）
    drawDetailedServer(container, lightLayer, 10, 1, 'Server');
    drawDetailedServer(container, lightLayer, 12, 1, 'DB');

    // 书架
    drawDetailedBookshelf(container, 14, 6);

    // 植物（带摇摆动画）
    drawDetailedPlant(container, 4, 1);
    drawDetailedPlant(container, 9, 7);
    drawDetailedPlant(container, 13, 9);

    // 灯具（带发光效果）
    drawDetailedLamp(container, lightLayer, 3, 3);
    drawDetailedLamp(container, lightLayer, 3, 6);

    // 装饰画
    drawDetailedPicture(container, 0, 5);
  };

  // 精细桌子
  const drawDetailedDesk = (container: Container, x: number, y: number, label: string) => {
    const desk = new Graphics();
    const px = x * PIXEL_SIZE;
    const py = y * PIXEL_SIZE;
    
    // 桌腿阴影
    desk.rect(px + 4, py + PIXEL_SIZE, 4, PIXEL_SIZE);
    desk.rect(px + PIXEL_SIZE * 2 - 8, py + PIXEL_SIZE, 4, PIXEL_SIZE);
    desk.fill(0x000000);
    desk.alpha = 0.2;
    
    // 桌面主体
    desk.rect(px, py, PIXEL_SIZE * 2, PIXEL_SIZE * 2);
    desk.fill(COLORS.desk);
    
    // 桌面高光
    desk.rect(px, py, PIXEL_SIZE * 2, 4);
    desk.fill(COLORS.deskTop);
    
    // 桌面边缘
    desk.rect(px, py + PIXEL_SIZE * 2 - 4, PIXEL_SIZE * 2, 4);
    desk.fill(COLORS.deskDark);
    
    container.addChild(desk);

    // 标签
    const text = new Text({
      text: label,
      style: new TextStyle({
        fontSize: 8,
        fill: 0xffffff,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      }),
    });
    text.x = px + PIXEL_SIZE - text.width / 2;
    text.y = py + PIXEL_SIZE + 8;
    container.addChild(text);
  };

  // 精细电脑（带屏幕发光）
  const drawDetailedComputer = (container: Container, lightLayer: Container, x: number, y: number) => {
    const px = x * PIXEL_SIZE + 4;
    const py = y * PIXEL_SIZE + 4;
    
    const computer = new Graphics();
    
    // 显示器底座阴影
    computer.rect(px + 6, py + 16, 12, 4);
    computer.fill(0x000000);
    computer.alpha = 0.3;
    
    // 显示器底座
    computer.rect(px + 6, py + 14, 12, 4);
    computer.fill(0x1a1a2e);
    
    // 显示器支架
    computer.rect(px + 10, py + 10, 4, 6);
    computer.fill(0x2d3748);
    
    // 显示器边框
    computer.rect(px, py, 24, 16);
    computer.fill(COLORS.computer);
    
    // 屏幕（发光效果）
    computer.rect(px + 2, py + 2, 20, 12);
    computer.fill(COLORS.screenOn);
    
    // 屏幕内容
    computer.rect(px + 4, py + 4, 16, 2);
    computer.fill(0xffffff);
    computer.alpha = 0.5;
    
    container.addChild(computer);

    // 屏幕光晕
    const glow = new Graphics();
    glow.rect(px - 2, py - 2, 28, 20);
    glow.fill({ color: COLORS.screenGlow, alpha: 0.1 });
    lightLayer.addChild(glow);
    lightsRef.current.push(glow);
  };

  // 精细椅子
  const drawDetailedChair = (container: Container, x: number, y: number) => {
    const chair = new Graphics();
    const px = x * PIXEL_SIZE + 4;
    const py = y * PIXEL_SIZE + 4;
    
    // 椅子阴影
    chair.rect(px + 2, py + 20, 20, 4);
    chair.fill(0x000000);
    chair.alpha = 0.2;
    
    // 椅子底座
    chair.rect(px + 8, py + 18, 8, 4);
    chair.fill(0x2d3748);
    
    // 椅子支柱
    chair.rect(px + 11, py + 12, 2, 8);
    chair.fill(0x4a5568);
    
    // 椅子座垫
    chair.rect(px + 4, py + 8, 24, 8);
    chair.fill(COLORS.chair);
    
    // 椅子靠背
    chair.rect(px + 4, py, 24, 10);
    chair.fill(COLORS.chairDark);
    
    // 靠背高光
    chair.rect(px + 6, py + 2, 20, 2);
    chair.fill(0x5a6a7a);
    
    container.addChild(chair);
  };

  // 精细沙发
  const drawDetailedSofa = (container: Container, x: number, y: number) => {
    const sofa = new Graphics();
    const px = x * PIXEL_SIZE;
    const py = y * PIXEL_SIZE;
    
    // 沙发阴影
    sofa.rect(px + 2, py + PIXEL_SIZE * 2 - 4, PIXEL_SIZE * 3 - 4, 4);
    sofa.fill(0x000000);
    sofa.alpha = 0.2;
    
    // 沙发主体
    sofa.rect(px, py + 8, PIXEL_SIZE * 3, PIXEL_SIZE * 2 - 8);
    sofa.fill(COLORS.sofa);
    
    // 沙发靠背
    sofa.rect(px, py, PIXEL_SIZE * 3, 12);
    sofa.fill(COLORS.sofaDark);
    
    // 沙发扶手
    sofa.rect(px, py + 8, 8, PIXEL_SIZE * 2 - 16);
    sofa.rect(px + PIXEL_SIZE * 3 - 8, py + 8, 8, PIXEL_SIZE * 2 - 16);
    sofa.fill(COLORS.sofaDark);
    
    // 沙发坐垫纹理
    sofa.rect(px + PIXEL_SIZE - 1, py + 8, 2, PIXEL_SIZE * 2 - 16);
    sofa.rect(px + PIXEL_SIZE * 2 - 1, py + 8, 2, PIXEL_SIZE * 2 - 16);
    sofa.fill(0x000000);
    sofa.alpha = 0.1;
    
    container.addChild(sofa);
  };

  // 精细桌子
  const drawDetailedTable = (container: Container, x: number, y: number) => {
    const table = new Graphics();
    const px = x * PIXEL_SIZE + 4;
    const py = y * PIXEL_SIZE + 4;
    
    // 桌子阴影
    table.rect(px + 2, py + 20, 24, 4);
    table.fill(0x000000);
    table.alpha = 0.2;
    
    // 桌腿
    table.rect(px + 4, py + 8, 4, 14);
    table.rect(px + 20, py + 8, 4, 14);
    table.fill(COLORS.deskDark);
    
    // 桌面
    table.rect(px, py, 28, 10);
    table.fill(COLORS.desk);
    
    // 桌面高光
    table.rect(px, py, 28, 3);
    table.fill(COLORS.deskTop);
    
    container.addChild(table);
  };

  // 精细咖啡（带粒子效果）
  const drawDetailedCoffee = (container: Container, x: number, y: number) => {
    const coffee = new Graphics();
    const px = x * PIXEL_SIZE + 8;
    const py = y * PIXEL_SIZE + 8;
    
    // 咖啡杯阴影
    coffee.rect(px + 2, py + 18, 12, 3);
    coffee.fill(0x000000);
    coffee.alpha = 0.2;
    
    // 咖啡杯
    coffee.rect(px, py + 4, 16, 16);
    coffee.fill(COLORS.coffee);
    
    // 咖啡杯把手
    coffee.rect(px + 14, py + 8, 4, 8);
    coffee.fill(COLORS.coffee);
    
    // 咖啡液面
    coffee.rect(px + 2, py + 6, 12, 2);
    coffee.fill(0x3d1f1f);
    
    container.addChild(coffee);
  };

  // 精细柜子
  const drawDetailedCabinet = (container: Container, x: number, y: number) => {
    const cabinet = new Graphics();
    const px = x * PIXEL_SIZE + 2;
    const py = y * PIXEL_SIZE + 2;
    
    // 柜子阴影
    cabinet.rect(px + 2, py + 26, 24, 3);
    cabinet.fill(0x000000);
    cabinet.alpha = 0.2;
    
    // 柜子主体
    cabinet.rect(px, py, 28, 28);
    cabinet.fill(COLORS.bookshelf);
    
    // 柜门缝隙
    cabinet.rect(px + 13, py + 2, 2, 24);
    cabinet.fill(0x000000);
    cabinet.alpha = 0.2;
    
    // 把手
    cabinet.rect(px + 10, py + 14, 3, 2);
    cabinet.rect(px + 15, py + 14, 3, 2);
    cabinet.fill(COLORS.deskTop);
    
    container.addChild(cabinet);
  };

  // 精细服务器（带闪烁灯）
  const drawDetailedServer = (container: Container, lightLayer: Container, x: number, y: number, label: string) => {
    const server = new Graphics();
    const px = x * PIXEL_SIZE;
    const py = y * PIXEL_SIZE;
    
    // 服务器阴影
    server.rect(px + 2, py + PIXEL_SIZE * 2 - 4, PIXEL_SIZE * 2 - 4, 4);
    server.fill(0x000000);
    server.alpha = 0.2;
    
    // 服务器主体
    server.rect(px, py, PIXEL_SIZE * 2, PIXEL_SIZE * 2);
    server.fill(COLORS.server);
    
    // 服务器边框
    server.rect(px, py, PIXEL_SIZE * 2, 2);
    server.rect(px, py + PIXEL_SIZE * 2 - 2, PIXEL_SIZE * 2, 2);
    server.fill(0x1a202c);
    
    // 通风口
    for (let i = 0; i < 3; i++) {
      server.rect(px + 4, py + 8 + i * 8, PIXEL_SIZE * 2 - 8, 2);
      server.fill(0x1a202c);
    }
    
    container.addChild(server);

    // 指示灯（动态）
    const lights = [0x48bb78, 0x4299e1, 0xed8936, 0xe53e3e];
    lights.forEach((color, i) => {
      const light = new Graphics();
      const lx = px + 6 + (i % 2) * 20;
      const ly = py + 4 + Math.floor(i / 2) * 6;
      light.circle(lx, ly, 3);
      light.fill(color);
      lightLayer.addChild(light);
      lightsRef.current.push(light);
    });
  };

  // 精细书架
  const drawDetailedBookshelf = (container: Container, x: number, y: number) => {
    const shelf = new Graphics();
    const px = x * PIXEL_SIZE;
    const py = y * PIXEL_SIZE;
    
    // 书架阴影
    shelf.rect(px + 2, py + PIXEL_SIZE * 3 - 4, PIXEL_SIZE * 2 - 4, 4);
    shelf.fill(0x000000);
    shelf.alpha = 0.2;
    
    // 书架主体
    shelf.rect(px, py, PIXEL_SIZE * 2, PIXEL_SIZE * 3);
    shelf.fill(COLORS.bookshelf);
    
    // 书架隔板
    shelf.rect(px, py + PIXEL_SIZE, PIXEL_SIZE * 2, 2);
    shelf.rect(px, py + PIXEL_SIZE * 2, PIXEL_SIZE * 2, 2);
    shelf.fill(0x000000);
    shelf.alpha = 0.2;
    
    // 书籍（不同大小和颜色）
    const bookColors = [0xe53e3e, 0x4299e1, 0x48bb78, 0xed8936, 0x9f7aea, 0x38b2ac];
    bookColors.forEach((color, i) => {
      const bx = px + 4 + (i % 2) * 16;
      const by = py + 4 + Math.floor(i / 2) * (PIXEL_SIZE + 2);
      const height = 10 + (i % 3) * 4;
      shelf.rect(bx, by + PIXEL_SIZE - height, 12, height);
      shelf.fill(color);
      // 书脊高光
      shelf.rect(bx, by + PIXEL_SIZE - height, 2, height);
      shelf.fill(0xffffff);
      shelf.alpha = 0.3;
    });
    
    container.addChild(shelf);
  };

  // 精细植物（带摇摆动画）
  const drawDetailedPlant = (container: Container, x: number, y: number) => {
    const plant = new Graphics();
    const px = x * PIXEL_SIZE + 8;
    const py = y * PIXEL_SIZE + 16;
    
    // 花盆阴影
    plant.rect(px + 2, py + 14, 12, 3);
    plant.fill(0x000000);
    plant.alpha = 0.2;
    
    // 花盆
    plant.rect(px, py, 16, 16);
    plant.fill(COLORS.plantPot);
    
    // 花盆边缘
    plant.rect(px, py, 16, 3);
    plant.fill(0xa0522d);
    
    // 植物叶子
    plant.rect(px + 2, py - 8, 4, 10);
    plant.rect(px + 6, py - 12, 4, 14);
    plant.rect(px + 10, py - 6, 4, 8);
    plant.fill(COLORS.plant);
    
    container.addChild(plant);
  };

  // 精细灯具（带发光效果）
  const drawDetailedLamp = (container: Container, lightLayer: Container, x: number, y: number) => {
    const lamp = new Graphics();
    const px = x * PIXEL_SIZE + 12;
    const py = y * PIXEL_SIZE + 8;
    
    // 灯杆
    lamp.rect(px + 6, py + 8, 4, 16);
    lamp.fill(0x4a5568);
    
    // 灯座
    lamp.rect(px + 4, py + 22, 8, 4);
    lamp.fill(0x2d3748);
    
    // 灯罩
    lamp.rect(px, py, 16, 10);
    lamp.fill(COLORS.lamp);
    
    // 灯罩高光
    lamp.rect(px, py, 16, 3);
    lamp.fill(COLORS.lampGlow);
    
    container.addChild(lamp);

    // 灯光效果
    const light = new Graphics();
    light.circle(px + 8, py + 20, 40);
    light.fill({ color: COLORS.lampGlow, alpha: 0.15 });
    lightLayer.addChild(light);
    lightsRef.current.push(light);
  };

  // 精细装饰画
  const drawDetailedPicture = (container: Container, x: number, y: number) => {
    const picture = new Graphics();
    const px = x * PIXEL_SIZE + 4;
    const py = y * PIXEL_SIZE + 4;
    
    // 画框阴影
    picture.rect(px + 2, py + 22, 24, 3);
    picture.fill(0x000000);
    picture.alpha = 0.2;
    
    // 画框
    picture.rect(px, py, 24, 24);
    picture.fill(0xe2e8f0);
    
    // 画框边框
    picture.rect(px, py, 24, 2);
    picture.rect(px, py + 22, 24, 2);
    picture.rect(px, py, 2, 24);
    picture.rect(px + 22, py, 2, 24);
    picture.fill(0xcbd5e0);
    
    // 画作内容
    picture.rect(px + 4, py + 4, 16, 16);
    picture.fill(0x81b29a);
    
    container.addChild(picture);
  };

  // 创建精细角色
  const createDetailedAgent = (container: Container, shadowLayer: Container, agent: PixelAgent) => {
    const agentContainer = new Container();
    agentContainer.x = agent.x * PIXEL_SIZE + PIXEL_SIZE / 2;
    agentContainer.y = agent.y * PIXEL_SIZE + PIXEL_SIZE / 2;
    agentContainer.eventMode = 'static';
    agentContainer.cursor = 'pointer';

    // 阴影
    const shadow = new Graphics();
    shadow.ellipse(0, 14, 12, 6);
    shadow.fill(0x000000);
    shadow.alpha = 0.2;
    shadowLayer.addChild(shadow);
    agentContainer.addChild(shadow);

    // 身体（带边框）
    const body = new Graphics();
    body.rect(-14, -14, 28, 28);
    body.fill(agent.color);
    body.rect(-14, -14, 28, 2);
    body.fill(0xffffff);
    body.alpha = 0.3;
    agentContainer.addChild(body);

    // 头像文字
    const avatar = new Text({
      text: agent.avatar,
      style: new TextStyle({
        fontSize: 20,
      }),
    });
    avatar.anchor.set(0.5);
    agentContainer.addChild(avatar);

    // 名字背景
    const nameBg = new Graphics();
    nameBg.roundRect(-30, 18, 60, 14, 7);
    nameBg.fill(0xffffff);
    nameBg.alpha = 0.9;
    agentContainer.addChild(nameBg);

    // 名字
    const nameText = new Text({
      text: agent.name,
      style: new TextStyle({
        fontSize: 9,
        fill: 0x2d3748,
        fontWeight: 'bold',
      }),
    });
    nameText.anchor.set(0.5);
    nameText.y = 25;
    agentContainer.addChild(nameText);

    // 状态指示器（带发光）
    const statusDot = new Graphics();
    const statusColors = {
      working: 0x4299e1,
      talking: 0x48bb78,
      moving: 0xed8936,
      idle: 0xa0aec0,
    };
    statusDot.circle(10, -10, 5);
    statusDot.fill(statusColors[agent.status]);
    agentContainer.addChild(statusDot);

    // 选中效果
    const selectionRing = new Graphics();
    selectionRing.circle(0, 0, 18);
    selectionRing.stroke({ width: 2, color: 0x6366f1 });
    selectionRing.visible = false;
    agentContainer.addChild(selectionRing);

    // 点击事件
    agentContainer.on('pointerdown', (e: any) => {
      const event = e.data?.originalEvent || e;
      dragRef.current = { 
        agent, 
        offsetX: event.clientX - agentContainer.x, 
        offsetY: event.clientY - agentContainer.y 
      };
      setSelectedAgent(agent);
      
      // 显示选中效果
      agentsRef.current.forEach(a => {
        if (a.container) {
          const ring = a.container.children[a.container.children.length - 1] as Graphics;
          if (ring) ring.visible = false;
        }
      });
      selectionRing.visible = true;
    });

    container.addChild(agentContainer);
    agent.container = agentContainer;
  };

  // 更新 Agents
  const updateAgents = (deltaTime: number) => {
    if (!isAutoRun) return;

    agentsRef.current.forEach(agent => {
      if (!agent.container || agent.isDragging) return;

      // 移动动画
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
          agent.status = 'idle';
          agent.walkCycle = 0;
          updateAgentVisual(agent);
        } else {
          agent.container.x += (dx / distance) * 3 * deltaTime;
          agent.container.y += (dy / distance) * 3 * deltaTime;
          agent.walkCycle = (agent.walkCycle || 0) + deltaTime * 0.2;
          
          // 行走动画（身体起伏）
          const bounce = Math.sin(agent.walkCycle) * 2;
          agent.container.children[1].y = bounce; // 身体
          agent.container.children[2].y = bounce; // 头像
        }
      }

      // 随机行为
      if (Math.random() < 0.005 && agent.status === 'idle') {
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        const newX = Math.max(0, Math.min(GRID_WIDTH - 1, agent.x + dx));
        const newY = Math.max(0, Math.min(GRID_HEIGHT - 1, agent.y + dy));
        
        if (newX !== agent.x || newY !== agent.y) {
          agent.targetX = newX;
          agent.targetY = newY;
          agent.status = 'moving';
          
          if (newX > agent.x) agent.direction = 'right';
          else if (newX < agent.x) agent.direction = 'left';
          else if (newY > agent.y) agent.direction = 'down';
          else if (newY < agent.y) agent.direction = 'up';
          
          updateAgentVisual(agent);
        }
      }

      // 工作状态切换
      if (Math.random() < 0.002 && agent.status === 'idle') {
        agent.status = 'working';
        updateAgentVisual(agent);
      }
      if (Math.random() < 0.001 && agent.status === 'working') {
        agent.status = 'idle';
        updateAgentVisual(agent);
      }
    });

    setAgents([...agentsRef.current]);
  };

  // 更新粒子
  const updateParticles = (deltaTime: number) => {
    const app = appRef.current;
    if (!app) return;

    // 咖啡热气粒子
    if (Math.random() < 0.05) {
      createSteamParticle(6 * PIXEL_SIZE + 16, 7 * PIXEL_SIZE + 8);
    }

    // 更新现有粒子
    particlesRef.current = particlesRef.current.filter(particle => {
      particle.life -= deltaTime;
      if (particle.life <= 0) {
        particle.graphics.destroy();
        return false;
      }
      
      particle.x += particle.vx * deltaTime;
      particle.y += particle.vy * deltaTime;
      particle.graphics.x = particle.x;
      particle.graphics.y = particle.y;
      particle.graphics.alpha = particle.life / particle.maxLife * 0.5;
      
      return true;
    });
  };

  // 创建热气粒子
  const createSteamParticle = (x: number, y: number) => {
    const app = appRef.current;
    if (!app) return;

    const graphics = new Graphics();
    graphics.circle(0, 0, 3);
    graphics.fill(0xffffff);
    graphics.x = x;
    graphics.y = y;
    graphics.alpha = 0.5;
    
    app.stage.children[4].addChild(graphics); // 粒子层
    
    particlesRef.current.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.5 - Math.random() * 0.5,
      life: 60,
      maxLife: 60,
      graphics,
    });
  };

  // 更新灯光
  const updateLights = (deltaTime: number) => {
    const time = Date.now() / 1000;
    
    lightsRef.current.forEach((light, index) => {
      // 服务器指示灯闪烁
      if (index >= 4 && index < 8) {
        const blink = Math.sin(time * 5 + index) > 0;
        light.alpha = blink ? 1 : 0.3;
      }
    });
  };

  // 更新动画
  const updateAnimations = (deltaTime: number) => {
    const time = Date.now() / 1000;
    
    // 植物摇摆
    agentsRef.current.forEach(agent => {
      if (agent.container && agent.status === 'idle') {
        const sway = Math.sin(time * 2 + parseInt(agent.id)) * 1;
        agent.container.rotation = sway * 0.02;
      }
    });
  };

  // 更新 Agent 视觉效果
  const updateAgentVisual = (agent: PixelAgent) => {
    if (!agent.container) return;

    // 更新状态点颜色
    const statusDot = agent.container.children[4] as Graphics;
    if (statusDot) {
      statusDot.clear();
      const statusColors = {
        working: 0x4299e1,
        talking: 0x48bb78,
        moving: 0xed8936,
        idle: 0xa0aec0,
      };
      statusDot.circle(10, -10, 5);
      statusDot.fill(statusColors[agent.status]);
    }

    // 方向翻转
    if (agent.direction === 'left') {
      agent.container.scale.x = -1;
    } else {
      agent.container.scale.x = 1;
    }
  };

  // Agent 说话
  const agentSpeak = useCallback((agentId: string, message: string) => {
    const agent = agentsRef.current.find(a => a.id === agentId);
    if (!agent || !agent.container) return;

    agent.message = message;
    agent.status = 'talking';
    agent.messageTime = Date.now();
    updateAgentVisual(agent);

    setChatHistory(prev => [...prev, {
      agent: agent.name,
      message,
      time: new Date(),
    }]);

    showMessageBubble(agent, message);

    setTimeout(() => {
      agent.message = undefined;
      agent.status = 'idle';
      updateAgentVisual(agent);
      hideMessageBubble(agent);
    }, 3000);
  }, []);

  // 显示消息气泡
  const showMessageBubble = (agent: PixelAgent, message: string) => {
    if (!agent.container) return;

    hideMessageBubble(agent);

    const bubble = new Container();
    
    const text = new Text({
      text: message,
      style: new TextStyle({
        fontSize: 12,
        fill: 0x2d3748,
        wordWrap: true,
        wordWrapWidth: 120,
      }),
    });
    
    const bg = new Graphics();
    bg.roundRect(0, 0, text.width + 16, text.height + 12, 8);
    bg.fill(0xffffff);
    bg.stroke({ width: 2, color: 0xe2e8f0 });
    
    text.x = 8;
    text.y = 6;
    
    bubble.addChild(bg);
    bubble.addChild(text);
    bubble.x = -bubble.width / 2;
    bubble.y = -55;
    
    agent.container.addChild(bubble);
    messageContainersRef.current.set(agent.id, bubble);
  };

  // 隐藏消息气泡
  const hideMessageBubble = (agent: PixelAgent) => {
    const bubble = messageContainersRef.current.get(agent.id);
    if (bubble && agent.container) {
      agent.container.removeChild(bubble);
      messageContainersRef.current.delete(agent.id);
    }
  };

  // 发送消息
  const handleSendMessage = () => {
    if (!chatInput.trim() || !selectedAgent) return;
    agentSpeak(selectedAgent.id, chatInput.trim());
    setChatInput('');
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
            Agents办公室 <span className="text-sm font-normal text-[#718096]">(高级版)</span>
          </h1>
          <p className="text-sm text-[#718096] mt-2">
            基于 PixiJS WebGL 的精细化像素办公室 - 带光影、粒子、动画效果
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

        {/* PixiJS 画布容器 */}
        <div 
          ref={canvasRef}
          className="rounded-2xl shadow-2xl overflow-hidden border-4 border-[#e2e8f0] inline-block"
        />

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
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-[#6366f1] rounded-lg flex items-center justify-center text-xs">✨</span>
            <span>光影效果</span>
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
                  style={{ backgroundColor: `#${selectedAgent.color.toString(16).padStart(6, '0')}` }}
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
              <span className="text-xs text-[#4a5568] font-medium">高级渲染</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

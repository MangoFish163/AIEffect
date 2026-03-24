import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js';
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
}

// 配置
const PIXEL_SIZE = 32;
const GRID_WIDTH = 16;
const GRID_HEIGHT = 12;
const CANVAS_WIDTH = GRID_WIDTH * PIXEL_SIZE;
const CANVAS_HEIGHT = GRID_HEIGHT * PIXEL_SIZE;

// 颜色配置
const COLORS = {
  floorWood: 0xd4a574,
  floorWoodDark: 0xb8935f,
  floorTile: 0xe8e4dc,
  floorTileDark: 0xd4cfc4,
  wall: 0xf5ebe0,
  desk: 0x8b6914,
  deskDark: 0x6b4e0a,
  deskTop: 0xa08060,
  chair: 0x4a5568,
  sofa: 0xc4a35a,
  sofaDark: 0xa08240,
  bookshelf: 0x6b4423,
  computer: 0x1a1a2e,
  screenOn: 0x48bb78,
  server: 0x2d3748,
  plant: 0x2d5016,
  plantPot: 0x8b4513,
  coffee: 0x4a2c2a,
  whiteboard: 0xffffff,
  lamp: 0xd69e2e,
  window: 0x87ceeb,
};

// 预设Agent
const INITIAL_AGENTS: PixelAgent[] = [
  { id: '1', name: 'Jarvis', role: '值班SRE', x: 2, y: 3, color: 0xe07a5f, avatar: '🤖', status: 'working', direction: 'down' },
  { id: '2', name: 'Monica', role: '开发', x: 2, y: 6, color: 0x3d405b, avatar: '👩‍💻', status: 'idle', direction: 'down' },
  { id: '3', name: '🦞', role: '休息中', x: 7, y: 5, color: 0xf4a261, avatar: '🦞', status: 'idle', direction: 'right' },
  { id: '4', name: 'Cat', role: '测试', x: 10, y: 2, color: 0x81b29a, avatar: '🐱', status: 'working', direction: 'down' },
  { id: '5', name: 'Bug', role: '安全', x: 13, y: 3, color: 0xf2cc8f, avatar: '🐛', status: 'idle', direction: 'left' },
];

export const AgentsOfficePixi: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const agentsRef = useRef<PixelAgent[]>(JSON.parse(JSON.stringify(INITIAL_AGENTS)));
  const [agents, setAgents] = useState<PixelAgent[]>(JSON.parse(JSON.stringify(INITIAL_AGENTS)));
  const [selectedAgent, setSelectedAgent] = useState<PixelAgent | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{agent: string, message: string, time: Date}[]>([]);
  const [isAutoRun, setIsAutoRun] = useState(true);
  const messageContainersRef = useRef<Map<string, Container>>(new Map());
  const selectedAgentRef = useRef<PixelAgent | null>(null);

  // 更新选中Agent的ref
  useEffect(() => {
    selectedAgentRef.current = selectedAgent;
  }, [selectedAgent]);

  // 初始化 PixiJS
  useEffect(() => {
    if (!canvasRef.current || appRef.current) return;

    const initPixi = async () => {
      const app = new Application();
      await app.init({
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        backgroundColor: COLORS.wall,
        antialias: false,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      appRef.current = app;
      canvasRef.current?.appendChild(app.canvas);

      // 创建场景容器
      const sceneContainer = new Container();
      app.stage.addChild(sceneContainer);

      // 绘制地板
      drawFloor(sceneContainer);

      // 绘制办公室物品
      drawOfficeItems(sceneContainer);

      // 创建Agents
      agentsRef.current.forEach(agent => {
        createAgent(sceneContainer, agent);
      });

      // 启动动画循环
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
      // 清理 canvas 元素
      if (canvasRef.current) {
        canvasRef.current.innerHTML = '';
      }
    };
  }, []);

  // 绘制地板
  const drawFloor = (container: Container) => {
    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const isWoodArea = x < 5 && y < 9;
        const isRestArea = x >= 5 && x <= 9 && y >= 3 && y <= 8;
        
        let color = COLORS.floorTile;
        if (isWoodArea) color = (x + y) % 2 === 0 ? COLORS.floorWood : COLORS.floorWoodDark;
        else if (isRestArea) color = (x + y) % 2 === 0 ? 0xe8ddd0 : 0xddd0c0;

        const floor = new Graphics();
        floor.rect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        floor.fill(color);
        container.addChild(floor);
      }
    }
  };

  // 绘制办公室物品
  const drawOfficeItems = (container: Container) => {
    // 左侧工作区 - 办公桌1
    drawDesk(container, 1, 2, 'SRE');
    drawComputer(container, 1, 2);
    drawChair(container, 2, 4);

    // 办公桌2
    drawDesk(container, 1, 5, 'Dev');
    drawComputer(container, 1, 5);
    drawChair(container, 2, 7);

    // 右侧工作区
    drawDesk(container, 13, 2, 'Test');
    drawComputer(container, 13, 2);
    drawChair(container, 13, 4);

    // 中央休息区
    drawSofa(container, 6, 4);
    drawTable(container, 7, 6);
    drawCoffee(container, 6, 7);

    // 咖啡吧台
    for (let i = 0; i < 4; i++) {
      drawCabinet(container, 5 + i, 1);
    }

    // 服务器
    drawServer(container, 10, 1, 'Server');
    drawServer(container, 12, 1, 'DB');

    // 书架
    drawBookshelf(container, 14, 6);

    // 白板
    drawWhiteboard(container, 0, 1);

    // 植物
    drawPlant(container, 4, 1);
    drawPlant(container, 9, 7);
    drawPlant(container, 13, 9);

    // 灯具
    drawLamp(container, 3, 3);
    drawLamp(container, 3, 6);

    // 窗户
    drawWindow(container, 5, 0);

    // 装饰画
    drawPicture(container, 0, 5);
  };

  // 绘制桌子
  const drawDesk = (container: Container, x: number, y: number, label: string) => {
    const desk = new Graphics();
    const px = x * PIXEL_SIZE;
    const py = y * PIXEL_SIZE;
    
    // 桌面主体
    desk.rect(px, py, PIXEL_SIZE * 2, PIXEL_SIZE * 2);
    desk.fill(COLORS.desk);
    
    // 桌面顶部
    desk.rect(px, py, PIXEL_SIZE * 2, 8);
    desk.fill(COLORS.deskTop);
    
    container.addChild(desk);

    // 标签
    const text = new Text({
      text: label,
      style: new TextStyle({
        fontSize: 8,
        fill: 0xffffff,
        fontFamily: 'Arial',
      }),
    });
    text.x = px + PIXEL_SIZE - text.width / 2;
    text.y = py + PIXEL_SIZE + 4;
    container.addChild(text);
  };

  // 绘制电脑
  const drawComputer = (container: Container, x: number, y: number) => {
    const computer = new Graphics();
    const px = x * PIXEL_SIZE + 4;
    const py = y * PIXEL_SIZE + 4;
    
    // 显示器
    computer.rect(px, py, 20, 16);
    computer.fill(COLORS.computer);
    
    // 屏幕
    computer.rect(px + 2, py + 2, 16, 10);
    computer.fill(COLORS.screenOn);
    
    container.addChild(computer);
  };

  // 绘制椅子
  const drawChair = (container: Container, x: number, y: number) => {
    const chair = new Graphics();
    const px = x * PIXEL_SIZE + 4;
    const py = y * PIXEL_SIZE + 4;
    
    chair.rect(px, py, 24, 24);
    chair.fill(COLORS.chair);
    
    container.addChild(chair);
  };

  // 绘制沙发
  const drawSofa = (container: Container, x: number, y: number) => {
    const sofa = new Graphics();
    const px = x * PIXEL_SIZE;
    const py = y * PIXEL_SIZE;
    
    sofa.rect(px, py, PIXEL_SIZE * 3, PIXEL_SIZE * 2);
    sofa.fill(COLORS.sofa);
    
    // 沙发边缘
    sofa.rect(px, py, PIXEL_SIZE * 3, 6);
    sofa.fill(COLORS.sofaDark);
    
    container.addChild(sofa);
  };

  // 绘制桌子
  const drawTable = (container: Container, x: number, y: number) => {
    const table = new Graphics();
    const px = x * PIXEL_SIZE + 4;
    const py = y * PIXEL_SIZE + 4;
    
    table.rect(px, py, 24, 20);
    table.fill(COLORS.desk);
    
    container.addChild(table);
  };

  // 绘制咖啡
  const drawCoffee = (container: Container, x: number, y: number) => {
    const coffee = new Graphics();
    const px = x * PIXEL_SIZE + 8;
    const py = y * PIXEL_SIZE + 8;
    
    coffee.rect(px, py, 16, 20);
    coffee.fill(COLORS.coffee);
    
    container.addChild(coffee);
  };

  // 绘制柜子
  const drawCabinet = (container: Container, x: number, y: number) => {
    const cabinet = new Graphics();
    const px = x * PIXEL_SIZE + 2;
    const py = y * PIXEL_SIZE + 2;
    
    cabinet.rect(px, py, 28, 28);
    cabinet.fill(COLORS.bookshelf);
    
    // 把手
    cabinet.rect(px + 12, py + 14, 4, 2);
    cabinet.fill(COLORS.deskTop);
    
    container.addChild(cabinet);
  };

  // 绘制服务器
  const drawServer = (container: Container, x: number, y: number, label: string) => {
    const server = new Graphics();
    const px = x * PIXEL_SIZE;
    const py = y * PIXEL_SIZE;
    
    server.rect(px, py, PIXEL_SIZE * 2, PIXEL_SIZE * 2);
    server.fill(COLORS.server);
    
    // 指示灯
    const lights = [0x48bb78, 0x4299e1, 0xed8936, 0xe53e3e];
    lights.forEach((color, i) => {
      server.rect(px + 4 + (i % 2) * 12, py + 4 + Math.floor(i / 2) * 12, 8, 8);
      server.fill(color);
    });
    
    container.addChild(server);
  };

  // 绘制书架
  const drawBookshelf = (container: Container, x: number, y: number) => {
    const shelf = new Graphics();
    const px = x * PIXEL_SIZE;
    const py = y * PIXEL_SIZE;
    
    shelf.rect(px, py, PIXEL_SIZE * 2, PIXEL_SIZE * 3);
    shelf.fill(COLORS.bookshelf);
    
    // 书籍
    const bookColors = [0xe53e3e, 0x4299e1, 0x48bb78, 0xed8936, 0x9f7aea, 0x38b2ac];
    bookColors.forEach((color, i) => {
      const bx = px + 4 + (i % 2) * 16;
      const by = py + 4 + Math.floor(i / 2) * 14;
      shelf.rect(bx, by, 12, 12);
      shelf.fill(color);
    });
    
    container.addChild(shelf);
  };

  // 绘制白板
  const drawWhiteboard = (container: Container, x: number, y: number) => {
    const board = new Graphics();
    const px = x * PIXEL_SIZE + 2;
    const py = y * PIXEL_SIZE;
    
    board.rect(px, py, 28, PIXEL_SIZE * 3);
    board.fill(COLORS.whiteboard);
    
    // 边框
    board.rect(px, py, 28, 2);
    board.fill(0xcccccc);
    
    container.addChild(board);
  };

  // 绘制植物
  const drawPlant = (container: Container, x: number, y: number) => {
    const plant = new Graphics();
    const px = x * PIXEL_SIZE + 8;
    const py = y * PIXEL_SIZE + 16;
    
    // 花盆
    plant.rect(px, py, 16, 16);
    plant.fill(COLORS.plantPot);
    
    // 植物
    plant.rect(px + 2, py - 8, 12, 12);
    plant.fill(COLORS.plant);
    
    container.addChild(plant);
  };

  // 绘制灯具
  const drawLamp = (container: Container, x: number, y: number) => {
    const lamp = new Graphics();
    const px = x * PIXEL_SIZE + 12;
    const py = y * PIXEL_SIZE + 8;
    
    // 灯杆
    lamp.rect(px + 6, py + 8, 4, 16);
    lamp.fill(0x4a5568);
    
    // 灯罩
    lamp.rect(px, py, 16, 10);
    lamp.fill(COLORS.lamp);
    
    container.addChild(lamp);
  };

  // 绘制窗户
  const drawWindow = (container: Container, x: number, y: number) => {
    const window = new Graphics();
    const px = x * PIXEL_SIZE;
    const py = y * PIXEL_SIZE;
    
    window.rect(px, py, PIXEL_SIZE * 6, PIXEL_SIZE);
    window.fill(COLORS.window);
    
    // 窗框
    for (let i = 1; i < 6; i++) {
      window.rect(px + i * PIXEL_SIZE - 1, py, 2, PIXEL_SIZE);
      window.fill(0xffffff);
    }
    
    container.addChild(window);
  };

  // 绘制装饰画
  const drawPicture = (container: Container, x: number, y: number) => {
    const picture = new Graphics();
    const px = x * PIXEL_SIZE + 4;
    const py = y * PIXEL_SIZE + 4;
    
    picture.rect(px, py, 24, 24);
    picture.fill(0xe2e8f0);
    
    container.addChild(picture);
  };

  // 创建Agent
  const createAgent = (container: Container, agent: PixelAgent) => {
    const agentContainer = new Container();
    agentContainer.x = agent.x * PIXEL_SIZE + PIXEL_SIZE / 2;
    agentContainer.y = agent.y * PIXEL_SIZE + PIXEL_SIZE / 2;
    agentContainer.eventMode = 'static';
    agentContainer.cursor = 'pointer';

    // 身体
    const body = new Graphics();
    body.rect(-14, -14, 28, 28);
    body.fill(agent.color);
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

    // 名字
    const nameText = new Text({
      text: agent.name,
      style: new TextStyle({
        fontSize: 10,
        fill: 0x2d3748,
        fontWeight: 'bold',
      }),
    });
    nameText.anchor.set(0.5);
    nameText.y = 22;
    agentContainer.addChild(nameText);

    // 状态指示器
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

    // 点击事件
    agentContainer.on('pointerdown', () => {
      setSelectedAgent(agent);
    });

    container.addChild(agentContainer);
    agent.container = agentContainer;
  };

  // 更新Agents
  const updateAgents = (deltaTime: number) => {
    if (!isAutoRun) return;

    agentsRef.current.forEach(agent => {
      if (!agent.container) return;

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
          updateAgentVisual(agent);
        } else {
          agent.container.x += (dx / distance) * 3 * deltaTime;
          agent.container.y += (dy / distance) * 3 * deltaTime;
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

    // 同步到React state
    setAgents([...agentsRef.current]);
  };

  // 更新Agent视觉效果
  const updateAgentVisual = (agent: PixelAgent) => {
    if (!agent.container) return;

    // 更新状态点颜色
    const statusDot = agent.container.children[3] as Graphics;
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

  // Agent说话
  const agentSpeak = useCallback((agentId: string, message: string) => {
    const agent = agentsRef.current.find(a => a.id === agentId);
    if (!agent || !agent.container) return;

    agent.message = message;
    agent.status = 'talking';
    agent.messageTime = Date.now();
    updateAgentVisual(agent);

    // 添加聊天历史
    setChatHistory(prev => [...prev, {
      agent: agent.name,
      message,
      time: new Date(),
    }]);

    // 显示消息气泡
    showMessageBubble(agent, message);

    // 3秒后清除消息
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

    // 移除旧的消息
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
    bg.rect(0, 0, text.width + 16, text.height + 12);
    bg.fill(0xffffff);
    bg.stroke({ width: 2, color: 0xe2e8f0 });
    
    text.x = 8;
    text.y = 6;
    
    bubble.addChild(bg);
    bubble.addChild(text);
    bubble.x = -bubble.width / 2;
    bubble.y = -50;
    
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
            Agents办公室
          </h1>
          <p className="text-sm text-[#718096] mt-2">
            基于 PixiJS WebGL 渲染的高性能像素办公室
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
              <span className="text-xs text-[#4a5568] font-medium">PixiJS渲染</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


import React, { useRef, useEffect, useState } from 'react';
import { ToolType, Point, Stroke } from '../types';

interface CanvasProps {
  tool: ToolType;
  strokes: Stroke[];
  onStrokeComplete: (stroke: Stroke) => void;
  currentPage: number;
  scale: number;
  penColor: string;
  penWidth: number;
  highlighterColor: string;
  highlighterWidth: number;
  eraserWidth: number;
}

const Canvas: React.FC<CanvasProps> = ({ 
  tool, 
  strokes, 
  onStrokeComplete, 
  currentPage, 
  scale,
  penColor,
  penWidth,
  highlighterColor,
  highlighterWidth,
  eraserWidth
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        redraw();
      }
    };

    window.addEventListener('resize', resize);
    resize();

    return () => window.removeEventListener('resize', resize);
  }, [strokes, currentPage, penColor, penWidth, highlighterColor, highlighterWidth, eraserWidth]);

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    strokes.filter(s => s.page === currentPage).forEach(stroke => {
      drawStroke(ctx, stroke);
    });

    if (currentPoints.length > 0) {
      drawStroke(ctx, {
        points: currentPoints,
        type: tool,
        color: getToolColor(tool),
        width: getToolWidth(tool),
        page: currentPage
      });
    }
  };

  const getToolColor = (t: ToolType) => {
    switch (t) {
      case ToolType.PEN: return penColor;
      case ToolType.HIGHLIGHTER: return highlighterColor;
      case ToolType.AI_PEN: return '#8b5cf6';
      case ToolType.ERASER: return 'rgba(0,0,0,1)';
      default: return '#000000';
    }
  };

  const getToolWidth = (t: ToolType) => {
    switch (t) {
      case ToolType.PEN: return penWidth;
      case ToolType.HIGHLIGHTER: return highlighterWidth;
      case ToolType.AI_PEN: return 3;
      case ToolType.ERASER: return eraserWidth;
      default: return 2;
    }
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    
    if (stroke.type === ToolType.ERASER) {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
    }

    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  };

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    setCurrentPoints([getPointerPos(e)]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    // Update cursor position if tool is eraser
    if (tool === ToolType.ERASER && cursorRef.current && canvasRef.current) {
        const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const rect = canvasRef.current.getBoundingClientRect();
        
        cursorRef.current.style.display = 'block';
        cursorRef.current.style.left = `${clientX - rect.left}px`;
        cursorRef.current.style.top = `${clientY - rect.top}px`;
        cursorRef.current.style.width = `${eraserWidth * scale}px`;
        cursorRef.current.style.height = `${eraserWidth * scale}px`;
    } else if (cursorRef.current) {
        cursorRef.current.style.display = 'none';
    }

    if (!isDrawing) return;
    setCurrentPoints(prev => [...prev, getPointerPos(e)]);
    redraw();
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentPoints.length > 1) {
      onStrokeComplete({
        points: currentPoints,
        type: tool,
        color: getToolColor(tool),
        width: getToolWidth(tool),
        page: currentPage
      });
    }
    setCurrentPoints([]);
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${tool === ToolType.ERASER ? 'cursor-none' : 'cursor-crosshair'}`}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={(e) => {
            endDrawing();
            if(cursorRef.current) cursorRef.current.style.display = 'none';
        }}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />
      {/* Visual Eraser Cursor */}
      <div 
        ref={cursorRef}
        className="pointer-events-none absolute border border-indigo-400 bg-indigo-50/20 rounded-full"
        style={{ 
            display: 'none', 
            transform: 'translate(-50%, -50%)',
            zIndex: 100 
        }}
      />
    </div>
  );
};

export default Canvas;

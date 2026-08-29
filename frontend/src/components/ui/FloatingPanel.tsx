"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";

interface FloatingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  initialLeft?: number;
  initialTop?: number;
  minWidth?: number;
  minHeight?: number;
}

export default function FloatingPanel({
  isOpen,
  onClose,
  title,
  children,
  initialWidth = 700,
  initialHeight = 500,
  initialLeft,
  initialTop,
  minWidth = 400,
  minHeight = 300,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevState, setPrevState] = useState({ size, position });
  const dragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });
  const resizeRef = useRef({
    isResizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  // 初始化位置（居中）
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const panel = panelRef.current;
      const left =
        initialLeft ?? (window.innerWidth - size.width) / 2;
      const top =
        initialTop ?? (window.innerHeight - size.height) / 2;
      setPosition({ left, top });
    }
  }, [isOpen, initialLeft, initialTop, size.width, size.height]);

  // 拖拽
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: position.left,
      startTop: position.top,
    };
  }, [position, isMaximized]);

  // 调整大小
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      isResizing: true,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: size.width,
      startHeight: size.height,
    };
  }, [size, isMaximized]);

  // 全局鼠标移动和松开
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragRef.current.isDragging) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPosition({
          left: Math.max(0, Math.min(
            window.innerWidth - 100,
            dragRef.current.startLeft + dx
          )),
          top: Math.max(0, Math.min(
            window.innerHeight - 40,
            dragRef.current.startTop + dy
          )),
        });
      }
      if (resizeRef.current.isResizing) {
        const dx = e.clientX - resizeRef.current.startX;
        const dy = e.clientY - resizeRef.current.startY;
        setSize({
          width: Math.max(minWidth, resizeRef.current.startWidth + dx),
          height: Math.max(minHeight, resizeRef.current.startHeight + dy),
        });
      }
    };

    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
      resizeRef.current.isResizing = false;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [minWidth, minHeight]);

  // 最大化/还原
  const toggleMaximize = () => {
    if (isMaximized) {
      setSize(prevState.size);
      setPosition(prevState.position);
    } else {
      setPrevState({ size, position });
      setSize({
        width: window.innerWidth - 40,
        height: window.innerHeight - 40,
      });
      setPosition({ left: 20, top: 20 });
    }
    setIsMaximized(!isMaximized);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-40 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
      style={{
        left: position.left,
        top: position.top,
        width: size.width,
        height: size.height,
      }}
    >
      {/* 头部 - 可拖拽 */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white cursor-move select-none flex-shrink-0"
        onMouseDown={handleDragStart}
        onDoubleClick={toggleMaximize}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <button
              onClick={onClose}
              className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors"
              title="关闭"
            />
          </div>
          <span className="font-medium text-sm text-slate-700 ml-2">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleMaximize}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            title={isMaximized ? "还原" : "最大化"}
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-hidden">{children}</div>

      {/* 右下角调整大小手柄 */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
        onMouseDown={handleResizeStart}
      >
        <svg
          className="absolute bottom-1 right-1 w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M10 14h2v-2h2v-2h2v4h-4zM6 14h2v-2h2v-2h2v2H8v2H6zM10 6h2v2h2v2h2V6h-4zM6 6h2v2h2v2h2V8H8V6H6z" />
        </svg>
      </div>
    </div>
  );
}

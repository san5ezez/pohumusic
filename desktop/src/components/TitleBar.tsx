import React from 'react';
import { Minus, Square, X, Copy } from 'lucide-react';

interface TitleBarProps {
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  onMinimize,
  onMaximize,
  onClose,
  isMaximized = false,
}) => {
  const handleMinimize = async () => {
    if (onMinimize) {
      onMinimize();
      return;
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch (_: unknown) {}
  };

  const handleMaximize = async () => {
    if (onMaximize) {
      onMaximize();
      return;
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().toggleMaximize();
    } catch (_: unknown) {}
  };

  const handleClose = async () => {
    if (onClose) {
      onClose();
      return;
    }
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch (_: unknown) {}
  };

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, .no-drag')) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().startDragging();
    } catch (_: unknown) {}
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, .no-drag')) return;
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().toggleMaximize();
    } catch (_: unknown) {}
  };

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      className="h-10 bg-[#070b13] border-b border-slate-800/80 flex items-center justify-between select-none z-50 text-slate-300 px-3 cursor-move shrink-0"
    >
      {/* Wordmark and draggable area */}
      <div data-tauri-drag-region className="flex items-center gap-2.5">
        <div className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center text-[9px] font-black text-white">
          P
        </div>
        <span className="text-xs font-semibold tracking-wide text-slate-200">
          PohuMusic Desktop
        </span>
      </div>

      {/* Non-draggable Window Control Buttons */}
      <div className="flex items-center h-full no-drag">
        <button
          type="button"
          onClick={handleMinimize}
          className="h-full px-3.5 hover:bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors"
          title="Свернуть"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleMaximize}
          className="h-full px-3.5 hover:bg-slate-800/80 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-colors"
          title={isMaximized ? 'Восстановить' : 'Развернуть'}
        >
          {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
        </button>

        <button
          type="button"
          onClick={handleClose}
          className="h-full px-4 hover:bg-rose-600 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          title="Закрыть"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

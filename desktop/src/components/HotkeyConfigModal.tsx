import React, { useState } from 'react';
import { X, Keyboard, Check } from 'lucide-react';
import type { HotkeyConfig } from '../types';

interface HotkeyConfigModalProps {
  config: HotkeyConfig;
  onSave: (newConfig: HotkeyConfig) => void;
  onClose: () => void;
}

export const HotkeyConfigModal: React.FC<HotkeyConfigModalProps> = ({
  config,
  onSave,
  onClose,
}) => {
  const [keys, setKeys] = useState<HotkeyConfig>({ ...config });
  const [recordingField, setRecordingField] = useState<keyof HotkeyConfig | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent, field: keyof HotkeyConfig) => {
    e.preventDefault();
    e.stopPropagation();
    setKeys((prev) => ({
      ...prev,
      [field]: e.code,
    }));
    setRecordingField(null);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-slate-100">Настройка горячих клавиш</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Горячие клавиши работают только тогда, когда окно PohuMusic активно и находится в фокусе (без захвата глобальных системных клавиш).
        </p>

        <div className="space-y-3 font-mono text-xs">
          {[
            { key: 'playPause' as const, label: 'Воспроизведение / Пауза' },
            { key: 'nextTrack' as const, label: 'Следующий трек' },
            { key: 'prevTrack' as const, label: 'Предыдущий трек' },
            { key: 'volumeUp' as const, label: 'Увеличение громкости' },
            { key: 'volumeDown' as const, label: 'Уменьшение громкости' },
          ].map(({ key, label }) => (
            <div
              key={key}
              className="flex items-center justify-between p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg"
            >
              <span className="text-slate-300 font-sans">{label}</span>
              <button
                type="button"
                onClick={() => setRecordingField(key)}
                onKeyDown={(e) => recordingField === key && handleKeyDown(e, key)}
                className={`px-3 py-1 rounded border text-xs ${
                  recordingField === key
                    ? 'border-blue-500 bg-blue-950/80 text-blue-300 animate-pulse'
                    : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600'
                }`}
              >
                {recordingField === key ? 'Нажмите клавишу...' : keys[key]}
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(keys);
              onClose();
            }}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Сохранить</span>
          </button>
        </div>
      </div>
    </div>
  );
};

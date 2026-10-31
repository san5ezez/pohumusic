import React from 'react';

interface SplashScreenProps {
  statusMessage?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  statusMessage = 'Подключение к PohuMusic Cloudflare Workers...',
}) => {
  return (
    <div className="fixed inset-0 bg-[#070b13] flex flex-col items-center justify-center z-50 select-none">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-blue-500/30">
            P
          </div>
          <div className="absolute inset-0 rounded-2xl bg-blue-500 animate-ping opacity-25" />
        </div>

        <div className="text-xl font-bold tracking-tight text-white mt-2">
          PohuMusic
        </div>

        <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
        </div>

        <p className="text-xs text-slate-400 font-mono mt-1">{statusMessage}</p>
      </div>
    </div>
  );
};

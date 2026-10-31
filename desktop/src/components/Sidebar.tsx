import React from 'react';
import {
  Home,
  Search,
  Library,
  Heart,
  ListMusic,
  History,
  Keyboard,
  User as UserIcon,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  accentColor: string;
  onOpenHotkeys: () => void;
  playlistsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  accentColor,
  onOpenHotkeys,
  playlistsCount,
}) => {
  const mainNav = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'search', label: 'Поиск', icon: Search },
    { id: 'library', label: 'Моя музыка', icon: Library },
  ];

  const libraryNav = [
    { id: 'favorites', label: 'Избранное', icon: Heart },
    { id: 'playlists', label: `Плейлисты (${playlistsCount}/10)`, icon: ListMusic },
    { id: 'history', label: 'История (15)', icon: History },
  ];

  return (
    <aside className="w-56 bg-[#0a0f1c] border-r border-slate-800/80 flex flex-col justify-between p-3 select-none shrink-0">
      <div className="space-y-6">
        {/* Main Section */}
        <div className="space-y-1">
          <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Музыка
          </div>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                }`}
                style={isActive ? { backgroundColor: `${accentColor}25`, color: accentColor } : {}}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Library Section */}
        <div className="space-y-1">
          <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Коллекция
          </div>
          {libraryNav.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60'
                }`}
                style={isActive ? { backgroundColor: `${accentColor}25`, color: accentColor } : {}}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Shortcuts & Profile Card */}
      <div className="pt-3 border-t border-slate-800/80 space-y-2">
        <button
          type="button"
          onClick={onOpenHotkeys}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 transition-colors"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>Горячие клавиши</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('profile')}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-900/60 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-400 text-xs font-bold">
            <UserIcon className="w-3.5 h-3.5" />
          </div>
          <div className="text-left truncate">
            <div className="font-semibold text-slate-200 truncate">Профиль</div>
            <div className="text-[10px] text-slate-500 truncate">@sanchez_admin</div>
          </div>
        </button>
      </div>
    </aside>
  );
};

import React from 'react';
import { 
  BookOpen, 
  Download, 
  Sun, 
  Moon, 
  Layers,
  LogOut
} from 'lucide-react';
import { BookSettings } from '../types/flipbook';

interface HeaderProps {
  settings: BookSettings;
  pageCount: number;
  activeNavTab: 'editor' | 'templates';
  setActiveNavTab: (tab: 'editor' | 'templates') => void;
  onOpenExportModal: () => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  hasUploaded?: boolean;
  userEmail?: string;
  userAvatar?: string;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  pageCount,
  activeNavTab,
  setActiveNavTab,
  onOpenExportModal,
  theme,
  setTheme,
  hasUploaded = false,
  userEmail,
  userAvatar,
  onLogout,
}) => {
  const isDark = theme === 'dark';

  return (
    <header className={`h-14 border-b px-4 flex items-center justify-between z-30 select-none transition-colors duration-200 ${
      isDark ? 'border-[#1e293b] bg-[#0b1326] text-[#dae2fd]' : 'border-slate-200 bg-white text-slate-800 shadow-xs'
    }`}>
      {/* Left: Brand & File info */}
      <div className="flex items-center space-x-4">
        {/* Brand Logo */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-[#494bd6] to-[#8083ff] flex items-center justify-center text-white shadow-md shadow-indigo-900/30">
            <Layers className="w-4 h-4" />
          </div>
          <span className={`font-bold text-base tracking-tight font-['Plus_Jakarta_Sans'] ${isDark ? 'text-white' : 'text-slate-900'}`}>
            FlipCraft <span className={isDark ? 'text-[#c0c1ff] font-medium' : 'text-[#494bd6] font-medium'}>Studio</span>
          </span>
        </div>

        {/* Separator */}
        <div className={`h-4 w-px ${isDark ? 'bg-[#1e293b]' : 'bg-slate-200'}`} />

        {/* Breadcrumb & Project Name */}
        <div className="flex items-center space-x-2 text-xs">
          <span className={`hidden sm:inline ${isDark ? 'text-[#908fa0]' : 'text-slate-400'}`}>Project</span>
          <span className={`hidden sm:inline ${isDark ? 'text-[#464554]' : 'text-slate-300'}`}>/</span>
          <div className={`flex items-center space-x-2 px-2.5 py-1 rounded border transition-colors ${
            isDark ? 'bg-[#171f33] border-[#222a3d] text-[#dae2fd]' : 'bg-slate-100 border-slate-200 text-slate-800'
          }`}>
            <BookOpen className="w-3.5 h-3.5 text-[#8083ff]" />
            <span className="font-medium max-w-[140px] md:max-w-[220px] truncate" title={hasUploaded ? settings.fileName : 'Awaiting PDF Upload'}>
              {hasUploaded ? settings.fileName : 'Awaiting PDF Upload'}
            </span>
          </div>

          {/* Status Badge */}
          {hasUploaded ? (
            <div className={`flex items-center space-x-1.5 border px-2 py-0.5 rounded-full text-[11px] font-medium ${
              isDark ? 'bg-[#00354a]/60 text-[#7bd0ff] border-[#009bd1]/30' : 'bg-sky-50 text-sky-700 border-sky-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-[#7bd0ff]' : 'bg-sky-500'}`} />
              <span>Ready ({pageCount} pages)</span>
            </div>
          ) : (
            <div className={`flex items-center space-x-1.5 border px-2 py-0.5 rounded-full text-[11px] font-medium ${
              isDark ? 'bg-[#222a3d]/60 text-[#908fa0] border-[#2d3449]' : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-[#908fa0]' : 'bg-slate-400'}`} />
              <span>Awaiting Upload</span>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Nav tabs with Light/Dark toggle */}
      <div className={`hidden lg:flex items-center space-x-1.5 p-1 rounded-lg border transition-colors ${
        isDark ? 'bg-[#131b2e] border-[#222a3d]' : 'bg-slate-100 border-slate-200'
      }`}>
        <button
          onClick={() => setActiveNavTab('editor')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeNavTab === 'editor'
              ? isDark 
                ? 'bg-[#222a3d] text-white shadow-sm'
                : 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
              : isDark
                ? 'text-[#908fa0] hover:text-[#dae2fd] hover:bg-[#171f33]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Editor
        </button>
        <button
          onClick={() => setActiveNavTab('templates')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
            activeNavTab === 'templates'
              ? isDark 
                ? 'bg-[#222a3d] text-white shadow-sm'
                : 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
              : isDark
                ? 'text-[#908fa0] hover:text-[#dae2fd] hover:bg-[#171f33]'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Templates
        </button>

        {/* Separator */}
        <div className={`h-4 w-px mx-0.5 ${isDark ? 'bg-[#222a3d]' : 'bg-slate-300'}`} />

        {/* Option to toggle Light or Dark mode */}
        <div 
          className={`flex items-center p-0.5 rounded-lg border transition-all ${
            isDark ? 'bg-[#0f172a] border-[#222a3d]' : 'bg-slate-200/80 border-slate-300'
          }`}
          title={isDark ? 'Current theme: Dark. Click Light to switch' : 'Current theme: Light. Click Dark to switch'}
        >
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              !isDark
                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                : 'text-[#908fa0] hover:text-[#dae2fd]'
            }`}
            title="Switch to Light Theme"
          >
            <Sun className={`w-3.5 h-3.5 ${!isDark ? 'text-amber-500 fill-amber-500/20' : 'text-slate-400'}`} />
            <span>Light</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              isDark
                ? 'bg-[#222a3d] text-white shadow-sm border border-[#2d3449]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Switch to Dark Theme"
          >
            <Moon className={`w-3.5 h-3.5 ${isDark ? 'text-indigo-400 fill-indigo-400/20' : 'text-slate-400'}`} />
            <span>Dark</span>
          </button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-2.5">
        {/* Export Flipbook button */}
        <button
          onClick={onOpenExportModal}
          disabled={!hasUploaded}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all border cursor-pointer ${
            !hasUploaded
              ? isDark
                ? 'opacity-40 cursor-not-allowed text-white/50 bg-[#494bd6]/40 border-transparent shadow-none'
                : 'opacity-40 cursor-not-allowed text-white/60 bg-indigo-300 border-transparent shadow-none'
              : 'text-white bg-gradient-to-r from-[#494bd6] to-[#6366f1] hover:from-[#3b3dbb] hover:to-[#4f46e5] shadow-md shadow-indigo-950/40 border-[#8083ff]/40'
          }`}
          title={hasUploaded ? 'Export publication' : 'Upload a PDF first to enable export'}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Flipbook</span>
        </button>

        {/* User Email & Avatar Badge */}
        <div className="flex items-center space-x-2 pl-1">
          {userEmail && (
            <div className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
              isDark ? 'bg-[#171f33] border-[#222a3d] text-[#dae2fd]' : 'bg-slate-100 border-slate-200 text-slate-800'
            }`}>
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span className="truncate max-w-[130px]">{userEmail}</span>
            </div>
          )}

          <div className="relative">
            <img
              src={userAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80"}
              alt="User avatar"
              className={`w-8 h-8 rounded-full border border-[#8083ff]/50 object-cover ring-2 ${
                isDark ? 'ring-[#0b1326]' : 'ring-white'
              }`}
            />
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ${
              isDark ? 'ring-[#0b1326]' : 'ring-white'
            }`} />
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                isDark ? 'bg-[#171f33] border-[#222a3d] text-[#908fa0] hover:text-[#ffb4ab] hover:bg-[#222a3d]' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
              }`}
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

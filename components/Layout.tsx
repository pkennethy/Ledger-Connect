
import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  ShoppingCart, 
  BookOpen, 
  PieChart, 
  Settings, 
  LogOut, 
  Menu,
  Cloud,
  CloudOff,
  User as UserIcon,
  Home,
  RefreshCw,
  MoreHorizontal
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { DICTIONARY, Language, User, UserRole } from '../types';
import { AdBanner } from './AdBanner';
import { MockService } from '../services/mockData';
import { useToast } from '../context/ToastContext';
import { CONFIG } from '../config';

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  lang: Language;
  setLang: (l: Language) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, lang, setLang }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const t = DICTIONARY[lang];
  const { showToast } = useToast();
  
  const mainContentRef = useRef<HTMLDivElement>(null);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbConnected, setDbConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      checkConnection();
      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname]);

  const checkConnection = async () => {
      if (!navigator.onLine) {
          setDbConnected(false);
          return;
      }
      setIsSyncing(true);
      try {
          const status = await MockService.checkTableHealth();
          setDbConnected(status.connected);
      } catch (e) {
          setDbConnected(false);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleLogout = () => {
      localStorage.removeItem('LC_CURRENT_USER');
      onLogout();
  };

  const adminNavItems = [
    { path: '/', icon: <LayoutDashboard size={20} />, label: t.dashboard },
    { path: '/orders', icon: <ShoppingCart size={20} />, label: t.orders },
    { path: '/products', icon: <Package size={20} />, label: t.products },
    { path: '/debts', icon: <BookOpen size={20} />, label: t.debts },
    { path: '/customers', icon: <Users size={20} />, label: t.customers },
    { path: '/reports', icon: <PieChart size={20} />, label: t.reports },
    { path: '/settings', icon: <Settings size={20} />, label: t.settings },
  ];

  const customerNavItems = [
    { path: '/', icon: <Home size={20} />, label: t.my_dashboard },
    { path: '/products', icon: <Package size={20} />, label: t.shop },
    { path: '/orders', icon: <ShoppingCart size={20} />, label: t.my_orders },
    { path: '/debts', icon: <BookOpen size={20} />, label: t.my_debts },
    { path: '/settings', icon: <UserIcon size={20} />, label: t.profile },
  ];

  const navItems = user.role === UserRole.ADMIN ? adminNavItems : customerNavItems;
  const mobilePrimaryItems = navItems.slice(0, 4);

  const scrollToTop = () => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = () => {
    setIsSidebarOpen(false);
    scrollToTop();
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-300">
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-slate-800 bg-blue-600 dark:bg-slate-900 text-white shadow-md">
            <h1 className="text-xl font-black tracking-tighter uppercase">Ledger<span className="text-blue-400 dark:text-blue-500">Connect</span></h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white/80 hover:text-white">
                <Menu size={24} />
            </button>
          </div>

          <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center space-x-3 bg-blue-50/50 dark:bg-slate-800/30">
            <img 
              src={user.avatarUrl || 'https://picsum.photos/100'} 
              alt="User" 
              className="w-10 h-10 rounded-full border-2 border-blue-200 dark:border-slate-700 object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{user.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-black">{user.role}</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={`flex items-center px-4 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 shadow-sm' 
                      : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  <span className={`mr-3 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200 dark:border-slate-800 space-y-3 bg-gray-50 dark:bg-slate-900">
            <button 
                onClick={() => setLang(lang === Language.EN ? Language.CN : Language.EN)}
                className="text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 px-4 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-all w-full shadow-sm"
            >
                {lang === Language.EN ? 'Language: EN / 中文' : '语言: 中文 / EN'}
            </button>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-3 text-xs font-black uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl transition-colors border border-red-100 dark:border-red-500/20"
            >
              <LogOut size={16} className="mr-2" />
              {t.logout}
            </button>
            <p className="text-[10px] text-center text-gray-400 dark:text-slate-600 mt-2 font-mono">v{CONFIG.APP_VERSION}</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 shadow-sm z-30 sticky top-0 shrink-0">
          <div className="flex items-center">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md mr-2"
              >
                <Menu size={24} />
              </button>
              <span className="lg:hidden font-black text-gray-800 dark:text-white text-lg tracking-tight uppercase">Ledger</span>
          </div>
          
          <div className="flex items-center ml-auto space-x-3">
             <button 
                onClick={checkConnection}
                className={`flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-full border transition-all ${
                    dbConnected 
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' 
                        : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
                }`}
             >
                {isSyncing ? (
                    <RefreshCw size={14} className="animate-spin" />
                ) : dbConnected ? (
                    <Cloud size={14} /> 
                ) : (
                    <CloudOff size={14} />
                )}
                <span className="hidden sm:inline">
                    {isSyncing ? 'Syncing' : dbConnected ? 'Live' : 'Offline'}
                </span>
             </button>
             <button 
                onClick={handleLogout}
                className="lg:hidden p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors"
             >
                <LogOut size={20} />
             </button>
          </div>
        </header>

        <main 
            ref={mainContentRef}
            className="flex-1 overflow-y-auto p-4 lg:p-6 pb-[130px] lg:pb-24 scroll-smooth bg-gray-50/50 dark:bg-slate-950"
        >
          <div className="max-w-7xl mx-auto">
             {children}
          </div>
        </main>
      </div>

      <div className="lg:hidden fixed bottom-[60px] left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex justify-around items-center h-[60px] z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] print:hidden">
         {mobilePrimaryItems.map(item => {
             const isActive = location.pathname === item.path;
             return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  onClick={scrollToTop}
                  className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                      isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600'
                  }`}
                >
                    {React.cloneElement(item.icon as React.ReactElement<any>, { size: 20 })}
                    <span className="text-[10px] font-bold mt-1">{item.label}</span>
                </Link>
             );
         })}
         <button 
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center justify-center w-full h-full text-gray-400 dark:text-slate-500"
         >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-bold mt-1">More</span>
         </button>
      </div>

      <AdBanner />
    </div>
  );
};
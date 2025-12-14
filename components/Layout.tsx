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
  
  // Ref for the scrollable main content area
  const mainContentRef = useRef<HTMLDivElement>(null);
  
  // Connection States
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [dbConnected, setDbConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
      // Listen for network changes
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Initial DB Check
      checkConnection();

      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  // Scroll to top whenever the route changes
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

  // Mobile Bottom Nav: First 4 items + "More"
  const mobilePrimaryItems = navItems.slice(0, 4);

  const scrollToTop = () => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavClick = () => {
    setIsSidebarOpen(false);
    scrollToTop();
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Mobile Drawer Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Desktop) / Drawer (Mobile) */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo Area */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 bg-blue-600 text-white shadow-md">
            <h1 className="text-xl font-bold tracking-wider">账客通 | Ledger</h1>
            {/* Close button for mobile drawer */}
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-white/80 hover:text-white">
                <Menu size={24} />
            </button>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-gray-100 flex items-center space-x-3 bg-blue-50/50">
            <img 
              src={user.avatarUrl || 'https://picsum.photos/100'} 
              alt="User" 
              className="w-10 h-10 rounded-full border-2 border-blue-200 object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
              <p className="text-xs text-blue-600 truncate font-medium">{user.role}</p>
            </div>
          </div>

          {/* Navigation Items (Full List) */}
          <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={handleNavClick}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700 shadow-sm' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className={`mr-3 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-200 space-y-3 bg-gray-50">
            <div className="flex justify-center">
                <button 
                    onClick={() => setLang(lang === Language.EN ? Language.CN : Language.EN)}
                    className="text-xs font-bold text-gray-600 bg-white border border-gray-300 px-4 py-2 rounded-full hover:bg-gray-100 transition-colors w-full shadow-sm"
                >
                    {lang === Language.EN ? 'Language: EN / 中文' : '语言: 中文 / EN'}
                </button>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100"
            >
              <LogOut size={18} className="mr-2" />
              {t.logout}
            </button>
            <p className="text-[10px] text-center text-gray-400 mt-2 font-mono">v{CONFIG.APP_VERSION}</p>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-8 shadow-sm z-30 sticky top-0 shrink-0">
          <div className="flex items-center">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md mr-2"
              >
                <Menu size={24} />
              </button>
              <span className="lg:hidden font-bold text-gray-800 text-lg">Ledger Connect</span>
          </div>
          
          <div className="flex items-center ml-auto space-x-3">
             <button 
                onClick={checkConnection}
                className={`flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    dbConnected 
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 cursor-pointer' 
                        : 'bg-red-50 text-red-700 border-red-200 cursor-pointer'
                }`}
                title={dbConnected ? "Connected to Supabase" : "Click to retry connection"}
             >
                {isSyncing ? (
                    <RefreshCw size={14} className="animate-spin" />
                ) : dbConnected ? (
                    <Cloud size={14} /> 
                ) : (
                    <CloudOff size={14} />
                )}
                <span className="hidden sm:inline">
                    {isSyncing ? 'Checking...' : dbConnected ? 'Connected' : 'Disconnected'}
                </span>
             </button>
             
             {/* Mobile Logout Button (Visible only on small screens) */}
             <button 
                onClick={handleLogout}
                className="lg:hidden p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title={t.logout}
             >
                <LogOut size={20} />
             </button>
          </div>
        </header>

        {/* Scrollable Content */}
        {/* Padding bottom accounts for Ad Banner (60px) + Bottom Nav (60px on mobile) */}
        <main 
            ref={mainContentRef}
            className="flex-1 overflow-y-auto p-4 lg:p-6 pb-[130px] lg:pb-24 scroll-smooth bg-gray-50/50"
        >
          <div className="max-w-7xl mx-auto">
             {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation (Fixed above Ad Banner) */}
      <div className="lg:hidden fixed bottom-[60px] left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-[60px] z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] print:hidden">
         {mobilePrimaryItems.map(item => {
             const isActive = location.pathname === item.path;
             return (
                <Link 
                  key={item.path} 
                  to={item.path} 
                  onClick={scrollToTop}
                  className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                      isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                    {React.cloneElement(item.icon as React.ReactElement<any>, { size: 22 })}
                    <span className="text-[10px] font-medium mt-1">{item.label}</span>
                </Link>
             );
         })}
         {/* "More" Button */}
         <button 
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center justify-center w-full h-full text-gray-400 hover:text-gray-600"
         >
            <MoreHorizontal size={22} />
            <span className="text-[10px] font-medium mt-1">More</span>
         </button>
      </div>

      {/* Ad Banner (Persistent) */}
      <AdBanner />
    </div>
  );
};
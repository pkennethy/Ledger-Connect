
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Customers } from './pages/Customers';
import { Products } from './pages/Products';
import { Orders } from './pages/Orders';
import { Debts } from './pages/Debts';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { User, Language } from './types';
import { MockService } from './services/mockData';
import { ToastProvider, useToast } from './context/ToastContext';
import { ToastContainer } from './components/Toast';
import { AlertCircle, RefreshCw } from 'lucide-react';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const settings = MockService.getSettings();
  const [lang, setLang] = useState<Language>(settings.language || Language.EN);
  const { showToast } = useToast();

  const initializeApp = async () => {
      setInitError(null);
      setIsInitializing(true);
      try {
          // Mandatory Database Sync
          await MockService.initialize();
          
          const savedUser = localStorage.getItem('LC_CURRENT_USER');
          if (savedUser) {
              setUser(JSON.parse(savedUser));
          }
      } catch (e: any) {
          console.error("Initialization failed:", e);
          setInitError(e.message || "Failed to connect to the database. This app requires an active internet connection.");
      } finally {
          setIsInitializing(false);
      }
  };

  useEffect(() => {
      initializeApp();
  }, []);

  // Apply Theme Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]); 

  // Prevent Right Click / Context Menu
  useEffect(() => {
    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
  
  const handleSetLang = (newLang: Language) => {
      setLang(newLang);
      MockService.updateSettings({ language: newLang });
  };

  const handleUpdateUser = (updates: Partial<User>) => {
      if (user) {
          const updatedUser = { ...user, ...updates };
          setUser(updatedUser);
          localStorage.setItem('LC_CURRENT_USER', JSON.stringify(updatedUser));
      }
  };

  if (isInitializing) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          </div>
      );
  }

  if (initError) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle size={32} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Connection Required</h1>
              <p className="text-gray-500 max-w-sm mb-6">{initError}</p>
              <button 
                onClick={initializeApp}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
              >
                  <RefreshCw size={18} /> Retry Connection
              </button>
          </div>
      );
  }

  if (!user) {
    return <Login onLogin={setUser} lang={lang} />;
  }

  return (
    <HashRouter>
      <Layout user={user} onLogout={() => setUser(null)} lang={lang} setLang={handleSetLang}>
        <Routes>
          <Route path="/" element={<Dashboard lang={lang} user={user} />} />
          <Route path="/customers" element={<Customers lang={lang} user={user} />} />
          <Route path="/products" element={<Products lang={lang} user={user} />} />
          <Route path="/orders" element={<Orders lang={lang} user={user} />} />
          <Route path="/debts" element={<Debts lang={lang} user={user} />} />
          <Route path="/reports" element={<Reports lang={lang} user={user} />} />
          <Route path="/settings" element={<Settings lang={lang} setLang={handleSetLang} user={user} onUpdateUser={handleUpdateUser} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

function App() {
  return (
    <ToastProvider>
       <ToastContainer />
       <AppContent />
    </ToastProvider>
  );
}

export default App;

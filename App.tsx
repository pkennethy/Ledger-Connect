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

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const settings = MockService.getSettings();
  const [lang, setLang] = useState<Language>(settings.language || Language.EN);
  const { showToast } = useToast();

  useEffect(() => {
      const init = async () => {
          try {
              await MockService.initialize();
          } catch (e) {
              console.error("Failed to sync data", e);
              showToast("Failed to sync with server. Using offline data.", "error");
          } finally {
              setIsInitializing(false);
          }
      };
      init();
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
          setUser({ ...user, ...updates });
      }
  };

  if (isInitializing) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
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
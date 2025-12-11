import React, { useState, useRef, useEffect } from 'react';
import { Save, Bell, Globe, Shield, Database, User as UserIcon, Mail, Camera, Download, Upload, Server, CheckCircle, AlertTriangle, Copy, FileText, Lock } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, SystemSettings, User, UserRole } from '../types';
import { useToast } from '../context/ToastContext';

interface PageProps {
    lang: Language;
    setLang: (lang: Language) => void;
    user: User;
    onUpdateUser?: (updates: Partial<User>) => void;
}

type TabId = 'profile' | 'notifications' | 'language' | 'backup' | 'security' | 'database';

export const Settings: React.FC<PageProps> = ({ lang, setLang, user, onUpdateUser }) => {
    const t = DICTIONARY[lang];
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<TabId>('profile');
    const [settings, setSettings] = useState<SystemSettings>(MockService.getSettings());
    const [profileForm, setProfileForm] = useState({
        name: user.name,
        email: user.email || '',
        phone: user.phone,
        avatarUrl: user.avatarUrl || ''
    });
    
    // Password Change State
    const [passwords, setPasswords] = useState({
        new: '',
        confirm: ''
    });

    const [isDirty, setIsDirty] = useState(false);
    
    // Refs for Import/Export
    const backupInputRef = useRef<HTMLInputElement>(null);
    const customerImportRef = useRef<HTMLInputElement>(null);
    const productImportRef = useRef<HTMLInputElement>(null);

    // Database Status
    const [dbStatus, setDbStatus] = useState<{connected: boolean, tables: Record<string, boolean>}>({ connected: false, tables: {} });
    const [checkingDb, setCheckingDb] = useState(false);

    useEffect(() => {
        if (activeTab === 'database') {
            checkDb();
        }
    }, [activeTab]);

    const checkDb = async () => {
        setCheckingDb(true);
        try {
            const status = await MockService.checkTableHealth();
            setDbStatus(status);
        } finally {
            setCheckingDb(false);
        }
    };

    const handleToggle = (key: keyof SystemSettings['notifications']) => {
        setSettings(prev => ({
            ...prev,
            notifications: {
                ...prev.notifications,
                [key]: !prev.notifications[key]
            }
        }));
        setIsDirty(true);
    };

    const handleSave = async () => {
        try {
            // 1. Save System Settings
            MockService.updateSettings(settings);

            // 2. Save Profile Changes (if on Profile tab)
            if (activeTab === 'profile') {
                if (!profileForm.name || !profileForm.email) {
                    showToast("Name and Email are required", 'error');
                    return;
                }

                const updates = {
                    name: profileForm.name,
                    email: profileForm.email,
                    avatarUrl: profileForm.avatarUrl || user.avatarUrl
                };

                // Update Backend
                await MockService.updateCustomer(user.id, updates);
                
                // Update Local App State
                if (onUpdateUser) {
                    onUpdateUser(updates);
                }
            }

            setIsDirty(false);
            showToast('Settings & Profile saved successfully', 'success');
        } catch (e) {
            console.error(e);
            showToast('Failed to save changes', 'error');
        }
    };

    const handleChangePassword = async () => {
        if (!passwords.new || !passwords.confirm) {
            showToast('Please fill in both password fields', 'error');
            return;
        }
        if (passwords.new !== passwords.confirm) {
            showToast('Passwords do not match', 'error');
            return;
        }
        if (passwords.new.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            await MockService.changePassword(user.id, passwords.new);
            showToast('Password updated successfully', 'success');
            setPasswords({ new: '', confirm: '' });
        } catch (e: any) {
            showToast(e.message || 'Failed to update password', 'error');
        }
    };

    const handleExport = () => {
        try {
            const data = MockService.getBackupData();
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `ledger_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Backup file downloaded successfully', 'success');
        } catch (e) {
            showToast('Failed to export data', 'error');
        }
    };

    const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                MockService.restoreBackupData(json);
                showToast('Data restored successfully! Reloading...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                showToast('Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
    };

    const parseCSVLine = (line: string) => {
        // Basic CSV split by comma, trimming quotes and whitespace
        return line.split(',').map(item => item.trim().replace(/^"|"$/g, ''));
    };

    const handleCustomerCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        showToast('Processing Customers CSV...', 'info');

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return;

            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
            let importedCount = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Skip header row if it contains column names
                if (i === 0 && line.toLowerCase().includes('name') && line.toLowerCase().includes('phone')) continue;

                const cols = parseCSVLine(line);
                if (cols.length < 2) continue; // Need at least name and phone

                // Map columns: Name, Phone, Email, Address
                const [name, phone, email, address] = cols;
                
                if (name && phone) {
                    await MockService.addCustomer({
                        id: `c-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        name,
                        phone,
                        email: email || '',
                        address: address || 'Philippines',
                        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                        totalDebt: 0,
                        role: UserRole.CUSTOMER
                    });
                    importedCount++;
                }
            }
            
            if (importedCount > 0) {
                showToast(`Imported ${importedCount} customers successfully`, 'success');
            } else {
                showToast('No valid customer records found in file', 'error');
            }
        };
        reader.readAsText(file);
        
        if (event.target) event.target.value = '';
    };

    const handleProductCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
        showToast('Processing Products CSV...', 'info');
        
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return;

            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
            let importedCount = 0;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // Skip header row
                if (i === 0 && line.toLowerCase().includes('name') && line.toLowerCase().includes('price')) continue;

                const cols = parseCSVLine(line);
                if (cols.length < 2) continue; // Need at least name and price

                // Map columns: Name, Price, Cost, Stock, Category
                const [name, priceStr, costStr, stockStr, category] = cols;
                const price = parseFloat(priceStr);

                if (name && !isNaN(price)) {
                     await MockService.addProduct({
                        id: `p-imp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        name,
                        price,
                        cost: parseFloat(costStr) || 0,
                        stock: parseInt(stockStr) || 0,
                        category: category || 'General',
                        imageUrl: `https://picsum.photos/300/300?random=${Math.random()}`
                    });
                    importedCount++;
                }
            }

            if (importedCount > 0) {
                showToast(`Imported ${importedCount} products successfully`, 'success');
            } else {
                showToast('No valid product records found in file', 'error');
            }
        };
        reader.readAsText(file);

        if (event.target) event.target.value = '';
    };

    const copySQL = () => {
        const sql = `-- Run this in Supabase SQL Editor to setup tables
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Customers Table
create table if not exists public.customers (
  id text primary key,
  name text not null,
  phone text,
  address text,
  "avatarUrl" text,
  "totalDebt" numeric default 0,
  role text default 'CUSTOMER',
  email text,
  password text,
  created_at timestamptz default now()
);

-- Products Table
create table if not exists public.products (
  id text primary key,
  name text not null,
  category text,
  price numeric default 0,
  cost numeric default 0,
  stock integer default 0,
  "imageUrl" text,
  description text,
  created_at timestamptz default now()
);

-- Orders Table
create table if not exists public.orders (
  id text primary key,
  "customerId" text references public.customers(id),
  "customerName" text,
  items jsonb,
  "totalAmount" numeric,
  status text,
  "createdAt" timestamptz default now(),
  "updatedAt" timestamptz default now()
);

-- Debts Table
create table if not exists public.debts (
  id text primary key,
  "customerId" text references public.customers(id),
  "orderId" text,
  amount numeric,
  "paidAmount" numeric default 0,
  items jsonb,
  category text,
  "createdAt" timestamptz default now(),
  status text,
  notes text
);

-- Repayments Table
create table if not exists public.repayments (
  id text primary key,
  "customerId" text references public.customers(id),
  amount numeric,
  category text,
  timestamp timestamptz default now(),
  method text
);

-- Enable RLS (Row Level Security)
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.debts enable row level security;
alter table public.repayments enable row level security;

-- Create Policies (Allow Public Access for Demo App)
create policy "Public Access Customers" on public.customers for all using (true);
create policy "Public Access Products" on public.products for all using (true);
create policy "Public Access Orders" on public.orders for all using (true);
create policy "Public Access Debts" on public.debts for all using (true);
create policy "Public Access Repayments" on public.repayments for all using (true);
`;
        navigator.clipboard.writeText(sql);
        showToast('SQL script copied to clipboard', 'success');
    };

    const TabButton = ({ id, icon: Icon, label }: { id: TabId, icon: any, label: string }) => (
        <button 
            onClick={() => setActiveTab(id)}
            className={`w-full text-left px-4 py-3 rounded-lg shadow-sm border flex items-center transition-all ${
                activeTab === id 
                ? 'bg-blue-50 border-blue-200 text-blue-600 font-medium' 
                : 'bg-white border-transparent text-gray-600 hover:bg-gray-50'
            }`}
        >
            <Icon size={18} className="mr-3" /> {label}
        </button>
    );

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t.settings}</h2>
                {isDirty && (
                    <button 
                        onClick={handleSave}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center shadow-sm hover:bg-blue-700 transition-all animate-pulse"
                    >
                        <Save size={18} className="mr-2" />
                        Save Changes
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Navigation Tabs */}
                <div className="col-span-1 space-y-2">
                    <TabButton id="profile" icon={UserIcon} label={t.profile} />
                    <TabButton id="notifications" icon={Bell} label="Notifications" />
                    <TabButton id="language" icon={Globe} label="Language & Region" />
                    <TabButton id="backup" icon={Database} label="Data & Backup" />
                    <TabButton id="database" icon={Server} label="Database" />
                    <TabButton id="security" icon={Shield} label="Security" />
                </div>

                {/* Main Content Area */}
                <div className="col-span-1 md:col-span-2 space-y-6">
                    
                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6 border-b border-gray-200 dark:border-gray-700 pb-2">Edit Profile</h3>
                            
                            <div className="flex flex-col items-center mb-6">
                                <div className="relative">
                                    <img 
                                        src={profileForm.avatarUrl || 'https://picsum.photos/100'} 
                                        alt="Avatar" 
                                        className="w-24 h-24 rounded-full border-4 border-gray-100 dark:border-gray-700 object-cover"
                                    />
                                    <button className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700">
                                        <Camera size={16} />
                                    </button>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">Tap to change photo</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.name}
                                        onChange={e => { setProfileForm({...profileForm, name: e.target.value}); setIsDirty(true); }}
                                        className="w-full p-2 bg-white border-2 border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number (Read-only)</label>
                                    <input 
                                        type="text" 
                                        value={profileForm.phone}
                                        readOnly
                                        className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                                    <input 
                                        type="email" 
                                        value={profileForm.email}
                                        onChange={e => { setProfileForm({...profileForm, email: e.target.value}); setIsDirty(true); }}
                                        className="w-full p-2 bg-white border-2 border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-500"
                                    />
                                </div>
                            </div>

                            {/* Change Password Section */}
                            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                                <h4 className="text-md font-bold text-gray-800 dark:text-white mb-4 flex items-center">
                                    <Lock size={16} className="mr-2" /> Security & Password
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                                        <input 
                                            type="password" 
                                            value={passwords.new}
                                            onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                                            placeholder="Enter new password"
                                            className="w-full p-2 bg-white border-2 border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                                        <input 
                                            type="password" 
                                            value={passwords.confirm}
                                            onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                                            placeholder="Confirm new password"
                                            className="w-full p-2 bg-white border-2 border-gray-300 dark:border-gray-500 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white placeholder-gray-500"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleChangePassword}
                                        disabled={!passwords.new || !passwords.confirm}
                                        className="bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Update Password
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* LANGUAGE TAB */}
                    {activeTab === 'language' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Language & Region</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Display Language</label>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Language for the user interface</p>
                                    </div>
                                    <select 
                                        className="border border-gray-300 dark:border-gray-600 rounded-lg p-2 text-sm bg-gray-50 dark:bg-gray-700 dark:text-white"
                                        value={lang}
                                        onChange={(e) => {
                                            const newLang = e.target.value as Language;
                                            setLang(newLang);
                                            setSettings({...settings, language: newLang});
                                            setIsDirty(true);
                                        }}
                                    >
                                        <option value={Language.EN}>English (US)</option>
                                        <option value={Language.CN}>Chinese (中文)</option>
                                    </select>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Color Theme</label>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">App appearance</p>
                                    </div>
                                    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                        <button 
                                            onClick={() => { setSettings({...settings, theme: 'light'}); setIsDirty(true); }}
                                            className={`px-3 py-1 text-xs rounded-md transition-all ${settings.theme === 'light' ? 'bg-white shadow text-gray-800' : 'text-gray-500 dark:text-gray-400'}`}
                                        >
                                            Light
                                        </button>
                                        <button 
                                            onClick={() => { setSettings({...settings, theme: 'dark'}); setIsDirty(true); }}
                                            className={`px-3 py-1 text-xs rounded-md transition-all ${settings.theme === 'dark' ? 'bg-gray-800 shadow text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                        >
                                            Dark
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* NOTIFICATIONS TAB */}
                    {activeTab === 'notifications' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Notification Preferences</h3>
                            <div className="space-y-4">
                                {[
                                    { id: 'email', label: 'Email Notifications', desc: 'Receive order summaries via email' },
                                    { id: 'push', label: 'Push Notifications', desc: 'Real-time alerts on your device' },
                                ].map((item) => (
                                    <div key={item.id} className="flex justify-between items-center">
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleToggle(item.id as any)}
                                            className={`w-11 h-6 flex items-center rounded-full transition-colors ${settings.notifications[item.id as keyof typeof settings.notifications] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${settings.notifications[item.id as keyof typeof settings.notifications] ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* BACKUP & DATA IMPORT TAB */}
                    {activeTab === 'backup' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Data & Backup</h3>
                            <div className="space-y-6">
                                {/* IMPORT SECTION */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                        <FileText size={16} className="mr-2" /> Import Data from CSV
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Customer Import */}
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                                            <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">Import Customers</h5>
                                            <p className="text-xs text-gray-500 mb-2">Required Columns: Name, Phone, Email, Address</p>
                                            <div className="bg-white dark:bg-gray-800 p-2 text-[10px] font-mono border border-gray-200 dark:border-gray-700 rounded mb-3 text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-nowrap">
                                                Name, Phone, Email, Address<br/>
                                                Juan Cruz, 09171234567, juan@email.com, Manila
                                            </div>
                                            <button 
                                                onClick={() => customerImportRef.current?.click()}
                                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
                                            >
                                                <Upload size={14} className="mr-2" /> Select CSV
                                            </button>
                                            <input type="file" ref={customerImportRef} accept=".csv" className="hidden" onChange={handleCustomerCSVImport} />
                                        </div>

                                        {/* Product Import */}
                                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                                            <h5 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">Import Products</h5>
                                            <p className="text-xs text-gray-500 mb-2">Required Columns: Name, Price, Cost, Stock, Category</p>
                                            <div className="bg-white dark:bg-gray-800 p-2 text-[10px] font-mono border border-gray-200 dark:border-gray-700 rounded mb-3 text-gray-600 dark:text-gray-400 overflow-x-auto whitespace-nowrap">
                                                Name, Price, Cost, Stock, Category<br/>
                                                Prem. Rice, 1200, 1000, 50, Grains
                                            </div>
                                            <button 
                                                onClick={() => productImportRef.current?.click()}
                                                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
                                            >
                                                <Upload size={14} className="mr-2" /> Select CSV
                                            </button>
                                            <input type="file" ref={productImportRef} accept=".csv" className="hidden" onChange={handleProductCSVImport} />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 dark:border-gray-700 pt-6">
                                    <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                        <Database size={16} className="mr-2" /> Full System Backup (JSON)
                                    </h4>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        Back up your entire database to a secure JSON file. You can restore this file on any device to recover all your data.
                                    </p>
                                    
                                    <div className="flex gap-4">
                                        <button 
                                            onClick={handleExport}
                                            className="flex-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-4 py-3 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-center font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                        >
                                            <Download size={20} className="mr-2" />
                                            Backup JSON
                                        </button>
                                        
                                        <button 
                                            onClick={() => backupInputRef.current?.click()}
                                            className="flex-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 px-4 py-3 rounded-lg border border-green-200 dark:border-green-800 flex items-center justify-center font-medium hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                                        >
                                            <Upload size={20} className="mr-2" />
                                            Restore JSON
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={backupInputRef}
                                            accept=".json"
                                            className="hidden"
                                            onChange={handleImportBackup}
                                        />
                                    </div>
                                </div>
                                
                                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Automatic Cloud Backup Email</label>
                                    <div className="relative">
                                        <Mail size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                        <input 
                                            type="email" 
                                            value={settings.backupEmail}
                                            onChange={(e) => {
                                                setSettings({...settings, backupEmail: e.target.value});
                                                setIsDirty(true);
                                            }}
                                            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500" 
                                        />
                                    </div>
                                </div>

                                <div className="pt-6 mt-6 border-t border-red-100 dark:border-red-900/30">
                                    <h4 className="text-sm font-bold text-red-600 mb-2">Danger Zone</h4>
                                    <button 
                                        onClick={() => {
                                            if(confirm('WARNING: This will delete all local data and reset the app. This cannot be undone.')) {
                                                MockService.factoryReset();
                                            }
                                        }}
                                        className="w-full bg-red-50 text-red-600 border border-red-200 px-4 py-3 rounded-lg flex items-center justify-center font-medium hover:bg-red-100 transition-colors"
                                    >
                                        <AlertTriangle size={18} className="mr-2" />
                                        Factory Reset (Clear Local Data)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* DATABASE TAB */}
                    {activeTab === 'database' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                             <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">Database Setup</h3>
                             
                             <div className="mb-6">
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">Connection Status</h4>
                                {checkingDb ? (
                                    <p className="text-gray-500">Checking connection...</p>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            {dbStatus.connected ? <CheckCircle size={18} className="text-green-500 mr-2" /> : <AlertTriangle size={18} className="text-red-500 mr-2" />}
                                            <span className={dbStatus.connected ? 'text-green-700' : 'text-red-700'}>{dbStatus.connected ? 'Connected to Supabase' : 'Connection Failed (Check Config)'}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            {Object.entries(dbStatus.tables).map(([table, exists]) => (
                                                <div key={table} className="flex items-center text-sm p-2 rounded bg-gray-50 dark:bg-gray-700">
                                                    {exists ? <CheckCircle size={14} className="text-green-500 mr-2" /> : <AlertTriangle size={14} className="text-orange-500 mr-2" />}
                                                    <span className="capitalize text-gray-700 dark:text-gray-200">{table}: {exists ? 'Active' : 'Missing'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                             </div>

                             <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 mb-4">
                                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center">
                                    <AlertTriangle size={18} className="mr-2" /> Setup Required
                                </h4>
                                <div className="text-sm text-blue-700 dark:text-blue-400 mb-3 space-y-1">
                                    <p>1. Copy the SQL below and run it in Supabase SQL Editor.</p>
                                    <p className="font-bold">2. Disable "Confirm Email" in Supabase Auth -> Providers -> Email.</p>
                                </div>
                                <button 
                                    onClick={copySQL}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center hover:bg-blue-700 transition-colors"
                                >
                                    <Copy size={16} className="mr-2" /> Copy SQL Script
                                </button>
                             </div>
                        </div>
                    )}

                    {/* SECURITY TAB */}
                    {activeTab === 'security' && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 text-center text-gray-500">
                             <Shield size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                             <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Security Settings</h3>
                             <p className="mb-4 text-sm">Two-factor authentication and password management coming soon.</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

import React, { useState, useRef, useEffect } from 'react';
import { Save, Bell, Globe, Shield, Database, User as UserIcon, Mail, Camera, Download, Upload, Server, CheckCircle, AlertTriangle, Copy, FileText, Lock, MailCheck, MailX, Plus, Trash2, RefreshCw, Activity, Info, X } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, SystemSettings, User, UserRole } from '../types';
import { useToast } from '../context/ToastContext';
import { CONFIG } from '../config';

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
    
    // CALIBRATION PROGRESS STATE
    const [isCalibrating, setIsCalibrating] = useState(false);
    const [calibrationStatus, setCalibrationStatus] = useState("Standing by...");
    const [calibrationProgress, setCalibrationProgress] = useState({ current: 0, total: 100 });

    const [passwords, setPasswords] = useState({
        new: '',
        confirm: ''
    });

    const [isDirty, setIsDirty] = useState(false);
    
    const backupInputRef = useRef<HTMLInputElement>(null);
    const customerImportRef = useRef<HTMLInputElement>(null);
    const productImportRef = useRef<HTMLInputElement>(null);

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
            MockService.updateSettings(settings);
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
                await MockService.updateCustomer(user.id, updates);
                if (onUpdateUser) onUpdateUser(updates);
            }
            setIsDirty(false);
            showToast('Settings & Profile saved successfully', 'success');
        } catch (e) {
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
            showToast('Backup file downloaded', 'success');
        } catch (e) {
            showToast('Export failed', 'error');
        }
    };

    const handleCalibrate = async () => {
        console.log("[SETTINGS UI] handleCalibrate() called.");
        
        const confirmation = confirm('SECURITY WARNING: This will perform a deep audit of every transaction. It fixes incorrect outstanding balances by re-calculating everything from the ground up. Continue?');
        
        if (!confirmation) {
            console.log("[SETTINGS UI] Audit cancelled by user.");
            return;
        }
        
        // Step A: Trigger immediate visual feedback
        setIsCalibrating(true);
        setCalibrationStatus("Establishing Secure Link...");
        setCalibrationProgress({ current: 0, total: 100 });

        // Step B: Double-wait to ensure React has rendered the loading state
        await new Promise(r => setTimeout(r, 100));
        await new Promise(r => requestAnimationFrame(r));

        try {
            console.log("[SETTINGS UI] Invoking MockService.recalibrateAllBalances...");
            const count = await MockService.recalibrateAllBalances((cur, tot, stat) => {
                console.log(`[SETTINGS UI] Progress Callback: ${cur}/${tot} - ${stat}`);
                setCalibrationProgress({ current: cur, total: tot });
                setCalibrationStatus(stat);
            });
            
            if (count === 0) {
                showToast("Audit complete: No records found to adjust.", "info");
                setIsCalibrating(false);
                return;
            }

            setCalibrationStatus("Audit Successful! Finalizing...");
            showToast(`Deep audit complete: Verified ${count} client accounts.`, 'success');
            
            setTimeout(() => {
                window.location.reload();
            }, 1800);
        } catch (e) {
            console.error("[SETTINGS UI] Critical Audit Error:", e);
            showToast('Deep audit failed. Check database logs.', 'error');
            setIsCalibrating(false);
            setCalibrationStatus("Failed.");
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
                showToast('Restore successful! Restarting...', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
                showToast('Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
    };

    const handleCustomerCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        showToast('Processing Customers...', 'info');
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
            let count = 0;
            for (let i = 0; i < lines.length; i++) {
                if (i === 0 && lines[i].toLowerCase().includes('name')) continue;
                const cols = lines[i].split(',').map(c => c.trim());
                if (cols.length >= 2) {
                    await MockService.addCustomer({
                        id: `c-imp-${Date.now()}-${Math.random()}`,
                        name: cols[0], phone: cols[1], email: cols[2] || '', address: cols[3] || 'Philippines',
                        avatarUrl: `https://ui-avatars.com/api/?name=${cols[0]}`, totalDebt: 0, role: UserRole.CUSTOMER
                    });
                    count++;
                }
            }
            showToast(`Imported ${count} customers`, 'success');
        };
        reader.readAsText(file);
    };

    const handleProductCSVImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        showToast('Processing Products...', 'info');
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target?.result as string;
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
            let count = 0;
            for (let i = 0; i < lines.length; i++) {
                if (i === 0 && lines[i].toLowerCase().includes('name')) continue;
                const cols = lines[i].split(',').map(c => c.trim());
                const price = parseFloat(cols[1]);
                if (cols[0] && !isNaN(price)) {
                    await MockService.addProduct({
                        id: `p-imp-${Date.now()}-${Math.random()}`,
                        name: cols[0], price, cost: parseFloat(cols[2]) || 0, stock: parseInt(cols[3]) || 0,
                        category: cols[4] || 'General', imageUrl: `https://picsum.photos/200?random=${Math.random()}`
                    });
                    count++;
                }
            }
            showToast(`Imported ${count} products`, 'success');
        };
        reader.readAsText(file);
    };

    const copySQL = () => {
        const sql = `-- Supabase SQL Setup... (Truncated for brevity)`;
        navigator.clipboard.writeText(sql);
        showToast('SQL script copied', 'success');
    };

    const TabButton = ({ id, icon: Icon, label }: { id: TabId, icon: any, label: string }) => (
        <button onClick={() => setActiveTab(id)} className={`w-full text-left px-4 py-3 rounded-xl shadow-sm border flex items-center transition-all ${activeTab === id ? 'bg-blue-50 border-blue-200 text-blue-600 font-bold' : 'bg-white border-transparent text-gray-500 hover:bg-gray-50'}`}>
            <Icon size={18} className="mr-3" /> {label}
        </button>
    );

    const progressPercentage = calibrationProgress.total > 0 
        ? Math.round((calibrationProgress.current / calibrationProgress.total) * 100) 
        : 0;

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-20">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">{t.settings}</h2>
                {isDirty && (
                    <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl flex items-center shadow-lg hover:bg-blue-700 transition-all animate-pulse font-bold text-sm">
                        <Save size={18} className="mr-2" /> Save Changes
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="col-span-1 space-y-2">
                    <TabButton id="profile" icon={UserIcon} label={t.profile} />
                    <TabButton id="notifications" icon={Bell} label="Notifications" />
                    <TabButton id="language" icon={Globe} label="Language & Theme" />
                    <TabButton id="backup" icon={Database} label="Maintenance & Data" />
                    <TabButton id="database" icon={Server} label="System Config" />
                </div>

                <div className="col-span-1 md:col-span-2 space-y-6">
                    {activeTab === 'profile' && (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-8">
                            <h3 className="text-lg font-black text-gray-800 dark:text-white mb-8 border-b dark:border-slate-800 pb-4 uppercase tracking-widest text-[10px]">Merchant Identity</h3>
                            <div className="flex flex-col items-center mb-8">
                                <div className="relative">
                                    <img src={profileForm.avatarUrl || 'https://picsum.photos/100'} alt="Avatar" className="w-24 h-24 rounded-[2rem] border-4 border-gray-100 dark:border-slate-800 object-cover shadow-xl" />
                                    <button className="absolute -bottom-2 -right-2 bg-blue-600 text-white p-2 rounded-xl shadow-lg hover:bg-blue-700 transition-transform active:scale-90"><Camera size={18} /></button>
                                </div>
                            </div>
                            <div className="space-y-5">
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Business Name</label><input type="text" value={profileForm.name} onChange={e => { setProfileForm({...profileForm, name: e.target.value}); setIsDirty(true); }} className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold dark:text-white transition-all" /></div>
                                <div><label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Contact Email</label><input type="email" value={profileForm.email} onChange={e => { setProfileForm({...profileForm, email: e.target.value}); setIsDirty(true); }} className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold dark:text-white transition-all" /></div>
                                <div className="pt-6 mt-6 border-t dark:border-slate-800">
                                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 ml-1">Change Password</h4>
                                    <input type="password" value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })} placeholder="New Passphrase" className="w-full p-4 mb-3 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold dark:text-white transition-all" />
                                    <input type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} placeholder="Confirm Passphrase" className="w-full p-4 mb-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold dark:text-white transition-all" />
                                    <button onClick={handleChangePassword} disabled={!passwords.new} className="w-full bg-slate-800 dark:bg-slate-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-900 transition-all disabled:opacity-30">Update Security</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'language' && (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-8 space-y-8">
                             <div className="flex justify-between items-center">
                                <div><h3 className="font-black text-gray-800 dark:text-white uppercase tracking-tight">System Language</h3><p className="text-xs text-gray-500">Regional translations</p></div>
                                <select className="bg-gray-50 dark:bg-slate-800 border-none rounded-xl p-3 text-sm font-bold dark:text-white outline-none ring-1 ring-gray-200 dark:ring-slate-700" value={lang} onChange={(e) => { setLang(e.target.value as Language); setIsDirty(true); }}>
                                    <option value={Language.EN}>English (US)</option>
                                    <option value={Language.CN}>中文 (Simplified)</option>
                                </select>
                             </div>
                             <div className="flex justify-between items-center">
                                <div><h3 className="font-black text-gray-800 dark:text-white uppercase tracking-tight">Interface Theme</h3><p className="text-xs text-gray-500">App color mode</p></div>
                                <div className="flex bg-gray-50 dark:bg-slate-800 p-1 rounded-xl">
                                    <button onClick={() => { setSettings({...settings, theme: 'light'}); setIsDirty(true); }} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${settings.theme === 'light' ? 'bg-white shadow-md text-blue-600' : 'text-gray-400'}`}>Light</button>
                                    <button onClick={() => { setSettings({...settings, theme: 'dark'}); setIsDirty(true); }} className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${settings.theme === 'dark' ? 'bg-slate-700 shadow-md text-white' : 'text-gray-400'}`}>Dark</button>
                                </div>
                             </div>
                        </div>
                    )}

                    {activeTab === 'backup' && (
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 rounded-3xl shadow-sm border border-indigo-100 dark:border-slate-800 p-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/30"><Activity size={24} /></div>
                                    <div><h3 className="text-lg font-black text-gray-800 dark:text-white uppercase tracking-tight">Audit & Recalibration</h3><p className="text-xs text-gray-600 dark:text-gray-400">Deep database synchronization</p></div>
                                </div>
                                <p className="text-sm text-indigo-700/80 dark:text-slate-400 mb-8 leading-relaxed font-medium">Use this engine to automatically recalculate every client's balance based on the raw ledger records. This fixes discrepancies where outstanding totals don't match individual debt/payment entries.</p>
                                
                                {isCalibrating && (
                                    <div className="mb-6 animate-in fade-in zoom-in-95 duration-500 border-2 border-indigo-500/30 dark:border-indigo-500/20 bg-white/80 dark:bg-slate-950/50 p-6 rounded-3xl shadow-2xl backdrop-blur-sm">
                                        <div className="flex justify-between items-end mb-4">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                    Database Audit Active
                                                </span>
                                                <span className="text-sm font-black text-gray-900 dark:text-white truncate max-w-[200px]">
                                                    {calibrationStatus}
                                                </span>
                                            </div>
                                            <span className="text-2xl font-black text-indigo-900 dark:text-white font-mono leading-none">{progressPercentage}%</span>
                                        </div>
                                        <div className="w-full h-4 bg-gray-100 dark:bg-slate-900 rounded-full overflow-hidden border dark:border-slate-800">
                                            <div 
                                                className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500 ease-out shadow-[0_0_20px_rgba(79,70,229,0.5)]" 
                                                style={{ width: `${progressPercentage}%` }}
                                            />
                                        </div>
                                        <div className="mt-4 flex justify-between items-center text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-t dark:border-slate-800 pt-3">
                                            <span>Processed {calibrationProgress.current} Items</span>
                                            <span>Target {calibrationProgress.total}</span>
                                        </div>
                                    </div>
                                )}

                                <button 
                                    onClick={handleCalibrate}
                                    disabled={isCalibrating} 
                                    className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 shadow-xl transition-all active:scale-[0.97] ${isCalibrating ? 'bg-slate-200 dark:bg-slate-800 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'}`}
                                >
                                    {isCalibrating ? <RefreshCw className="animate-spin" size={18} /> : <Server size={18} />}
                                    {isCalibrating ? 'Auditing Database...' : 'Recalibrate All Balances Now'}
                                </button>
                                <div className="mt-6 flex items-start gap-3 bg-white/50 dark:bg-slate-950/30 p-4 rounded-2xl border border-indigo-200/50 dark:border-slate-700/50">
                                    <Info className="text-indigo-500 shrink-0 mt-0.5" size={16} />
                                    <p className="text-[10px] font-bold text-indigo-600 dark:text-slate-400 uppercase leading-relaxed tracking-wider">Note: This safely re-calculates all summaries from your existing records. No data will be deleted.</p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-8 space-y-6">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Data Management</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button onClick={handleExport} className="p-5 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-3xl flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all"><Download size={24} className="text-blue-500"/><span className="text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300">Export Backup</span></button>
                                    <button onClick={() => backupInputRef.current?.click()} className="p-5 border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-3xl flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all"><Upload size={24} className="text-green-500"/><span className="text-[10px] font-black uppercase tracking-widest text-gray-600 dark:text-gray-300">Import Restore</span></button>
                                    <input type="file" ref={backupInputRef} accept=".json" className="hidden" onChange={handleImportBackup} />
                                </div>
                                <div className="pt-6 border-t dark:border-slate-800">
                                    <button onClick={() => { if(confirm('Factory Reset? All data will be wiped.')) MockService.factoryReset(); }} className="w-full bg-red-50 dark:bg-rose-950/20 text-red-600 dark:text-rose-400 border border-red-100 dark:border-rose-900/50 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-red-100 transition-all">Emergency Wipe (Factory Reset)</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'database' && (
                        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border dark:border-slate-800 p-8">
                             <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 ml-1">Supabase Infrastructure</h3>
                             <div className="mb-8 p-6 bg-gray-50 dark:bg-slate-950 rounded-2xl border dark:border-slate-800">
                                {checkingDb ? <p className="text-xs font-bold text-gray-400 animate-pulse">Pinging database...</p> : (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 font-black uppercase text-[10px]">{dbStatus.connected ? <><CheckCircle size={14} className="text-emerald-500" /><span className="text-emerald-600">Connection Secured</span></> : <><AlertTriangle size={14} className="text-rose-500" /><span className="text-rose-600">Link Severed</span></>}</div>
                                        <div className="grid grid-cols-2 gap-3">
                                            {Object.entries(dbStatus.tables).map(([table, exists]) => (
                                                <div key={table} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-xl shadow-sm border dark:border-slate-800">
                                                    <span className="text-[10px] font-black text-gray-500 uppercase">{table}</span>
                                                    {exists ? <CheckCircle size={12} className="text-emerald-500" /> : <X size={12} className="text-rose-500" />}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                             </div>
                             <button onClick={copySQL} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"><Copy size={16} /> Get DB Sync Script</button>
                        </div>
                    )}
                </div>
            </div>
            <div className="text-center text-[10px] font-black text-gray-300 dark:text-slate-700 uppercase tracking-[0.3em] py-8">Ledger Connect Pro v{CONFIG.APP_VERSION}</div>
        </div>
    );
};


import React, { useState } from 'react';
import { Users, Package, ShoppingCart, TrendingDown, DollarSign, Clock, AlertCircle, ChevronRight, X, List, Printer, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, User, UserRole, OrderStatus, DebtRecord, OrderItem } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
    lang: Language;
    user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;
    const summary = MockService.getSummary();
    const [selectedActivity, setSelectedActivity] = useState<any>(null);

    // Mock chart data - in real app this would come from analytics service
    const chartData = [
        { name: 'Mon', debt: 4000, income: 2400 },
        { name: 'Tue', debt: 3000, income: 1398 },
        { name: 'Wed', debt: 2000, income: 9800 },
        { name: 'Thu', debt: 2780, income: 3908 },
        { name: 'Fri', debt: 1890, income: 4800 },
        { name: 'Sat', debt: 2390, income: 3800 },
        { name: 'Sun', debt: 3490, income: 4300 },
    ];

    const recentActivity = [
        ...MockService.getDebts().slice(0, 5).map(d => ({ ...d, type: 'DEBT' })),
        ...MockService.getRepayments().slice(0, 5).map(r => ({ ...r, type: 'PAYMENT', createdAt: r.timestamp }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

    const StatCard = ({ title, value, icon: Icon, color, link }: any) => (
        <Link to={link} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-800 hover:shadow-xl hover:-translate-y-1 transition-all group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${color} text-white shadow-lg`}>
                    <Icon size={24} />
                </div>
                <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
            </div>
            <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
        </Link>
    );

    return (
        <div className="space-y-8 pb-10">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{isAdmin ? 'Business Overview' : 'My Account'}</h2>
                    <p className="text-sm text-gray-500 font-bold mt-1">Welcome back, {user.name}</p>
                </div>
                <div className="hidden md:block bg-blue-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-blue-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard title="Outstanding" value={`₱${summary.totalDebt.toLocaleString()}`} icon={TrendingDown} color="bg-red-500" link="/debts" />
                <StatCard title="Active Clients" value={MockService.getCustomers().length} icon={Users} color="bg-blue-500" link="/customers" />
                <StatCard title="Inventory" value={MockService.getProducts().length} icon={Package} color="bg-orange-500" link="/products" />
                <StatCard title="Pending" value={MockService.getOrders().filter(o => o.status === OrderStatus.PENDING).length} icon={Clock} color="bg-indigo-500" link="/orders" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800">
                    <h3 className="text-lg font-black text-gray-800 dark:text-white mb-8 uppercase tracking-widest flex items-center gap-2">
                        <TrendingDown size={20} className="text-blue-500" /> Cashflow Trends
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                                <YAxis hide />
                                <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                                <Area type="monotone" dataKey="debt" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorDebt)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800">
                    <h3 className="text-lg font-black text-gray-800 dark:text-white mb-8 uppercase tracking-widest flex items-center gap-2">
                        <Clock size={20} className="text-orange-500" /> Activity
                    </h3>
                    <div className="space-y-6">
                        {recentActivity.map((activity: any, idx) => (
                            <div 
                                key={idx} 
                                onClick={() => setSelectedActivity(activity)}
                                className="flex items-center justify-between group cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md ${activity.type === 'DEBT' ? 'bg-red-500' : 'bg-green-500'}`}>
                                        {activity.type === 'DEBT' ? <DollarSign size={18} /> : <TrendingDown size={18} className="rotate-180" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 dark:text-slate-100 leading-none mb-1">
                                            {activity.type === 'DEBT' ? 'New Credit' : 'Payment'}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-black font-mono ${activity.type === 'DEBT' ? 'text-red-600' : 'text-green-600'}`}>
                                        {activity.type === 'DEBT' ? '+' : '-'}₱{activity.amount.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {selectedActivity && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <FileText size={20} strokeWidth={3} />
                                <h3 className="font-black uppercase tracking-tight text-sm">Transaction Journal</h3>
                            </div>
                            <button onClick={() => setSelectedActivity(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-8">
                            <div className="text-center mb-8">
                                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-inner ${selectedActivity.type === 'DEBT' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                    <DollarSign size={40} />
                                </div>
                                <h4 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">₱{selectedActivity.amount.toLocaleString()}</h4>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">{selectedActivity.type === 'DEBT' ? 'Accounts Receivable' : 'Payment Received'}</p>
                            </div>
                            
                            <div className="space-y-4 border-t dark:border-slate-800 pt-6">
                                <div className="flex justify-between">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Category</span>
                                    <span className="text-xs font-black text-blue-600 uppercase">{selectedActivity.category}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Timestamp</span>
                                    <span className="text-xs font-black text-gray-800 dark:text-slate-200">{new Date(selectedActivity.createdAt).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-xs font-bold text-gray-400 uppercase">Ref ID</span>
                                    <span className="text-[10px] font-mono font-bold text-gray-400">#{selectedActivity.id.slice(-8).toUpperCase()}</span>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => setSelectedActivity(null)}
                                className="w-full mt-8 py-4 bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

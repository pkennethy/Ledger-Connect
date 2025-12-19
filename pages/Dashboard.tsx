
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
    const summary = MockService.getSummary();
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;

    // Modal State
    const [viewingTxn, setViewingTxn] = useState<DebtRecord | null>(null);

    // Admin Stats with Paths
    const adminStats = [
        { label: t.total_debt, value: `₱${summary.totalDebt.toLocaleString()}`, icon: <TrendingDown size={24} />, color: 'bg-red-500', path: '/debts' },
        { label: t.total_customers, value: MockService.getCustomers().length, icon: <Users size={24} />, color: 'bg-blue-500', path: '/customers' },
        { label: t.pending_orders, value: MockService.getOrders().filter(o => o.status === 'PENDING').length, icon: <ShoppingCart size={24} />, color: 'bg-orange-500', path: '/orders' },
        { label: t.total_products, value: MockService.getProducts().length, icon: <Package size={24} />, color: 'bg-emerald-500', path: '/products' },
    ];

    // Customer Stats with Paths
    const myDebts = MockService.getDebts(user.id);
    const totalMyDebt = myDebts.reduce((acc, d) => acc + d.amount, 0);
    const totalMyPaid = myDebts.reduce((acc, d) => acc + d.paidAmount, 0);
    const myBalance = totalMyDebt - totalMyPaid;
    
    const customerStats = [
        { label: "My Balance Due", value: `₱${myBalance.toLocaleString()}`, icon: <AlertCircle size={24} />, color: 'bg-red-600', path: '/debts' },
        { label: "Total Borrowed", value: `₱${totalMyDebt.toLocaleString()}`, icon: <DollarSign size={24} />, color: 'bg-blue-600', path: '/debts' },
        { label: "Total Repaid", value: `₱${totalMyPaid.toLocaleString()}`, icon: <TrendingDown size={24} />, color: 'bg-green-600', path: '/debts' },
        { label: "Pending Orders", value: MockService.getOrders(user.id).filter(o => o.status === 'PENDING').length, icon: <Clock size={24} />, color: 'bg-orange-500', path: '/orders' },
    ];

    const stats = isAdmin ? adminStats : customerStats;

    // --- CHART DATA GENERATION ---
    const allRepayments = isAdmin ? MockService.getRepayments() : MockService.getRepayments(user.id);
    const allOrders = isAdmin ? MockService.getOrders() : MockService.getOrders(user.id);
    const allDebts = isAdmin ? MockService.getDebts() : MockService.getDebts(user.id);

    const getLast7Days = () => {
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }
        return days;
    };
    
    const last7Days = getLast7Days();
    
    const chartData = last7Days.map(dateStr => {
        const dateDisplay = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
        
        const dayRepayments = allRepayments
            .filter(r => r.timestamp.startsWith(dateStr))
            .reduce((sum, r) => sum + r.amount, 0);
            
        const dayCashSales = allOrders
            .filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(dateStr))
            .reduce((sum, o) => sum + o.totalAmount, 0);

        const dayIncome = dayRepayments + dayCashSales;

        const dayDebt = allDebts
            .filter(d => d.createdAt.startsWith(dateStr))
            .reduce((sum, d) => sum + d.amount, 0);

        return {
            name: dateDisplay,
            income: dayIncome,
            debt: dayDebt
        };
    });

    // --- ACTIVITY DATA ---
    const recentActivity = (isAdmin ? MockService.getDebts() : myDebts)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8);

    return (
        <div className="space-y-6 pb-[140px]">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {isAdmin ? t.dashboard : `${t.welcome}, ${user.name}`}
                </h2>
                {!isAdmin && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{user.phone}</span>
                )}
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <Link 
                        key={index} 
                        to={stat.path}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex items-center space-x-4 border border-gray-100 dark:border-gray-700 hover:shadow-md hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
                    >
                        <div className={`p-3 rounded-lg text-white ${stat.color} shadow-lg shadow-blue-900/10 group-hover:scale-110 transition-transform`}>
                            {stat.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</h3>
                        </div>
                        <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 transition-colors" size={18} />
                    </Link>
                ))}
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Chart Area */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                            {isAdmin ? 'Revenue & Debt Overview (7 Days)' : 'My Spending History (7 Days)'}
                        </h3>
                    </div>
                    <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorDebt" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-700" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                                <Tooltip 
                                    contentStyle={{
                                        borderRadius: '8px', 
                                        border: 'none', 
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)'
                                    }} 
                                />
                                <Area type="monotone" dataKey="income" stroke="#3b82f6" fillOpacity={1} fill="url(#colorIncome)" name="Income (Paid)" />
                                <Area type="monotone" dataKey="debt" stroke="#ef4444" fillOpacity={1} fill="url(#colorDebt)" name="Debt (Credit)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                            {isAdmin ? 'Recent Activity' : 'Recent Transactions'}
                        </h3>
                        <Link to="/debts" className="text-xs text-blue-600 font-bold hover:underline">View All</Link>
                    </div>
                    <div className="space-y-4 overflow-y-auto flex-1 max-h-[400px] pr-2 scrollbar-hide">
                         {recentActivity.map(debt => (
                             <button 
                                key={debt.id} 
                                onClick={() => setViewingTxn(debt)}
                                className="w-full text-left flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border border-transparent hover:border-blue-100 dark:hover:border-gray-600 group"
                             >
                                 <div className="flex-1 min-w-0">
                                     <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                         {isAdmin ? (MockService.getCustomers().find(c => c.id === debt.customerId)?.name || 'Unknown') : debt.category}
                                     </p>
                                     <p className="text-xs text-gray-500 dark:text-gray-400">
                                         {debt.category} • {debt.items.length > 0 ? `${debt.items.length} items` : 'Manual Entry'}
                                     </p>
                                 </div>
                                 <div className="text-right ml-4 flex items-center gap-2">
                                     <div>
                                        <p className={`text-sm font-bold ${debt.status === 'PAID' ? 'text-green-600' : 'text-red-600'}`}>
                                            ₱{debt.amount.toLocaleString()}
                                        </p>
                                        <p className="text-[10px] text-gray-400">{new Date(debt.createdAt).toLocaleDateString()}</p>
                                     </div>
                                     <ChevronRight size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                 </div>
                             </button>
                         ))}
                         {recentActivity.length === 0 && (
                             <div className="text-center text-gray-400 py-12 flex flex-col items-center gap-2">
                                 <Clock className="opacity-20" size={48} />
                                 <p className="text-sm">No recent activity found</p>
                             </div>
                         )}
                    </div>
                </div>
            </div>

            {/* TRANSACTION DETAIL MODAL */}
            {viewingTxn && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-wider text-sm">Activity Details</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">{new Date(viewingTxn.createdAt).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setViewingTxn(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Account</p>
                                    <p className="font-bold text-gray-900 dark:text-white text-lg leading-none">
                                        {MockService.getCustomers().find(c => c.id === viewingTxn.customerId)?.name || 'Unknown Account'}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">Category</p>
                                    <p className="font-bold text-blue-600 dark:text-blue-400 uppercase text-xs tracking-wider">{viewingTxn.category}</p>
                                </div>
                            </div>

                            {viewingTxn.items && viewingTxn.items.length > 0 ? (
                                <div className="border rounded-xl overflow-hidden mb-6">
                                    <table className="w-full text-left text-sm border-collapse">
                                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b dark:border-gray-700">
                                            <tr>
                                                <th className="px-3 py-2">Item</th>
                                                <th className="px-3 py-2 text-center">Qty</th>
                                                <th className="px-3 py-2 text-right">Price</th>
                                                <th className="px-3 py-2 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {viewingTxn.items.map((item: OrderItem, idx: number) => (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-3 py-3 font-bold text-gray-800 dark:text-gray-200">{item.productName}</td>
                                                    <td className="px-3 py-3 text-center text-gray-500 font-mono">x{item.quantity}</td>
                                                    <td className="px-3 py-3 text-right text-gray-500 font-mono">₱{item.price.toLocaleString()}</td>
                                                    <td className="px-3 py-3 text-right font-black text-gray-900 dark:text-white font-mono">₱{(item.price * item.quantity).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl mb-6 border border-gray-100 dark:border-gray-700">
                                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-2">Internal Notes</p>
                                    <p className="text-gray-700 dark:text-gray-300 font-medium italic">
                                        {viewingTxn.notes || "No additional notes provided for this manual entry."}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-900/80 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                                <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Grand Total</span>
                                <span className="text-3xl font-black text-red-600 font-mono tracking-tighter">₱{viewingTxn.amount.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 flex gap-2">
                             <button onClick={() => window.print()} className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"><Printer size={16} /> Print Receipt</button>
                             <button onClick={() => setViewingTxn(null)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center transition-colors hover:bg-blue-700 uppercase tracking-widest">Close View</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Package, ShoppingCart, TrendingDown, DollarSign, Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, User, UserRole, OrderStatus } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
    lang: Language;
    user: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ lang, user }) => {
    const navigate = useNavigate();
    const summary = MockService.getSummary();
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;

    // Admin Stats
    const adminStats = [
        { 
            label: t.total_debt, 
            value: `₱${summary.totalDebt.toLocaleString()}`, 
            icon: <TrendingDown size={24} />, 
            color: 'bg-red-500',
            path: '/debts' 
        },
        { 
            label: t.total_customers, 
            value: MockService.getCustomers().length, 
            icon: <Users size={24} />, 
            color: 'bg-blue-500',
            path: '/customers'
        },
        { 
            label: t.pending_orders, 
            value: MockService.getOrders().filter(o => o.status === 'PENDING').length, 
            icon: <ShoppingCart size={24} />, 
            color: 'bg-orange-500',
            path: '/orders'
        },
        { 
            label: t.total_products, 
            value: MockService.getProducts().length, 
            icon: <Package size={24} />, 
            color: 'bg-emerald-500',
            path: '/products'
        },
    ];

    // Customer Stats
    const myCustomerData = MockService.getCustomers().find(c => c.id === user.id);
    const myDebts = MockService.getDebts(user.id);
    const totalMyDebt = myDebts.reduce((acc, d) => acc + d.amount, 0);
    const totalMyPaid = myDebts.reduce((acc, d) => acc + d.paidAmount, 0);
    const myBalance = totalMyDebt - totalMyPaid;
    
    const customerStats = [
        { 
            label: "My Balance Due", 
            value: `₱${myBalance.toLocaleString()}`, 
            icon: <AlertCircle size={24} />, 
            color: 'bg-red-600',
            path: '/debts'
        },
        { 
            label: "Total Borrowed", 
            value: `₱${totalMyDebt.toLocaleString()}`, 
            icon: <DollarSign size={24} />, 
            color: 'bg-blue-600',
            path: '/debts'
        },
        { 
            label: "Total Repaid", 
            value: `₱${totalMyPaid.toLocaleString()}`, 
            icon: <TrendingDown size={24} />, 
            color: 'bg-green-600',
            path: '/debts'
        },
        { 
            label: "Pending Orders", 
            value: MockService.getOrders(user.id).filter(o => o.status === 'PENDING').length, 
            icon: <Clock size={24} />, 
            color: 'bg-orange-500',
            path: '/orders'
        },
    ];

    const stats = isAdmin ? adminStats : customerStats;

    // --- CHART DATA GENERATION ---
    const allDebts = isAdmin ? MockService.getDebts() : MockService.getDebts(user.id);
    const allRepayments = isAdmin ? MockService.getRepayments() : MockService.getRepayments(user.id);
    const allOrders = isAdmin ? MockService.getOrders() : MockService.getOrders(user.id);

    // Generate last 7 days dates array
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
        
        // Income: Cash Orders + Repayments on this day
        const dayRepayments = allRepayments
            .filter(r => r.timestamp.startsWith(dateStr))
            .reduce((sum, r) => sum + r.amount, 0);
            
        const dayCashSales = allOrders
            .filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(dateStr))
            .reduce((sum, o) => sum + o.totalAmount, 0);

        const dayIncome = dayRepayments + dayCashSales;

        // Debt: New Debts created on this day
        const dayDebt = allDebts
            .filter(d => d.createdAt.startsWith(dateStr))
            .reduce((sum, d) => sum + d.amount, 0);

        return {
            name: dateDisplay,
            income: dayIncome,
            debt: dayDebt
        };
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    {isAdmin ? t.dashboard : `${t.welcome}, ${user.name}`}
                </h2>
                {!isAdmin && (
                    <span className="text-sm text-gray-500">{user.phone}</span>
                )}
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <div 
                        key={index} 
                        onClick={() => navigate(stat.path)}
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex items-center space-x-4 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-95 group"
                    >
                        <div className={`p-3 rounded-lg text-white ${stat.color} shadow-lg shadow-blue-900/10`}>
                            {stat.icon}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{stat.label}</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</h3>
                        </div>
                        <ArrowRight size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                ))}
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Chart Area - Admin Only or History for Customer */}
                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                            {isAdmin ? 'Revenue & Debt Overview (7 Days)' : 'My Spending History (7 Days)'}
                        </h3>
                        <button 
                            onClick={() => navigate('/reports')} 
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                            View Report
                        </button>
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
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                                <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af'}} />
                                <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}} />
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
                            {isAdmin ? 'Recent Debts' : 'Recent Transactions'}
                        </h3>
                        <button 
                            onClick={() => navigate('/debts')}
                            className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                            View All
                        </button>
                    </div>
                    <div className="space-y-4 overflow-y-auto flex-1 max-h-[300px] pr-2">
                         {(isAdmin ? MockService.getDebts() : myDebts).slice(0, 5).map(debt => (
                             <div 
                                key={debt.id} 
                                onClick={() => navigate('/debts')}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer group"
                             >
                                 <div>
                                     <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                         {isAdmin ? (MockService.getCustomers().find(c => c.id === debt.customerId)?.name || 'Unknown') : debt.category}
                                     </p>
                                     <p className="text-xs text-gray-500 dark:text-gray-400">{debt.category} • {debt.items.length} items</p>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-sm font-bold text-red-600">₱{debt.amount}</p>
                                     <p className="text-xs text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300 transition-colors">{new Date(debt.createdAt).toLocaleDateString()}</p>
                                 </div>
                             </div>
                         ))}
                         {(!isAdmin && myDebts.length === 0) && (
                             <div className="text-center text-gray-400 py-8">No transactions yet</div>
                         )}
                    </div>
                </div>
            </div>
        </div>
    );
};
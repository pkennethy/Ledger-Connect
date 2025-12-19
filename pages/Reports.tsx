
import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Language, DICTIONARY, User, UserRole, OrderStatus, Customer } from '../types';
import { MockService } from '../services/mockData';
import { Calendar, Filter, FileText, ChevronDown, List, PieChart as PieChartIcon, ArrowRight, TrendingUp, TrendingDown, Wallet, Search, Printer, Download } from 'lucide-react';

interface PageProps {
    lang: Language;
    user: User;
}

type ReportView = 'summary' | 'ledger';
type Period = 'today' | 'week' | 'month' | 'year';

export const Reports: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;
    
    // UI State
    const [view, setView] = useState<ReportView>('summary');
    const [period, setPeriod] = useState<Period>('month');
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');

    // --- DATA HELPERS ---
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

    const getPeriodDates = (p: Period) => {
        const now = new Date();
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        if (p === 'today') {
            // Start is already today 00:00
        } else if (p === 'week') {
            start.setDate(now.getDate() - 7);
        } else if (p === 'month') {
            start.setMonth(now.getMonth() - 1);
        } else if (p === 'year') {
            start.setFullYear(now.getFullYear() - 1);
        }

        return { 
            start: start.toISOString().split('T')[0],
            end: now.toISOString().split('T')[0]
        };
    };

    const getLocalDateFromISO = (iso: string) => iso.split('T')[0];

    // --- CALCULATIONS FOR DETAILED LEDGER ---
    const ledgerData = useMemo(() => {
        const { start, end } = getPeriodDates(period);
        
        // Filter transactions
        const allDebts = isAdmin 
            ? (selectedCustomerId === 'all' ? MockService.getDebts() : MockService.getDebts(selectedCustomerId))
            : MockService.getDebts(user.id);
            
        const allRepayments = isAdmin
            ? (selectedCustomerId === 'all' ? MockService.getRepayments() : MockService.getRepayments(selectedCustomerId))
            : MockService.getRepayments(user.id);

        // Opening Balance (Historical total before 'start')
        const oldDebts = allDebts.filter(d => getLocalDateFromISO(d.createdAt) < start);
        const oldPaid = allRepayments.filter(p => getLocalDateFromISO(p.timestamp) < start);
        const openingBalance = oldDebts.reduce((s, d) => s + d.amount, 0) - oldPaid.reduce((s, p) => s + p.amount, 0);

        // Transactions within period
        const periodDebts = allDebts.filter(d => {
            const dt = getLocalDateFromISO(d.createdAt);
            return dt >= start && dt <= end;
        }).map(d => ({
            id: d.id,
            date: d.createdAt,
            type: 'DEBT',
            particulars: d.items.length > 0 ? (d.items.length === 1 ? d.items[0].productName : `${d.items[0].productName} +${d.items.length - 1}`) : (d.notes || 'Manual Entry'),
            debit: d.amount,
            credit: 0,
            customerName: isAdmin ? MockService.getCustomers().find(c => c.id === d.customerId)?.name : ''
        }));

        const periodPayments = allRepayments.filter(p => {
            const dt = getLocalDateFromISO(p.timestamp);
            return dt >= start && dt <= end;
        }).map(p => ({
            id: p.id,
            date: p.timestamp,
            type: 'PAYMENT',
            particulars: `Repayment: ${p.category}`,
            debit: 0,
            credit: p.amount,
            customerName: isAdmin ? MockService.getCustomers().find(c => c.id === p.customerId)?.name : ''
        }));

        const transactions = [...periodDebts, ...periodPayments]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let running = openingBalance;
        const processedTxns = transactions.map(t => {
            running = running + t.debit - t.credit;
            return { ...t, balance: running };
        });

        const totalAdded = periodDebts.reduce((s, d) => s + d.debit, 0);
        const totalPaid = periodPayments.reduce((s, p) => s + p.credit, 0);

        return {
            openingBalance,
            transactions: processedTxns,
            totalAdded,
            totalPaid,
            closingBalance: running
        };
    }, [period, selectedCustomerId, isAdmin, user.id]);

    // --- SUMMARY ANALYTICS CALCULATIONS (Existing) ---
    const adminReportsData = useMemo(() => {
        if (!isAdmin) return null;
        const allCustomers = MockService.getCustomers();
        const allProducts = MockService.getProducts();
        const allDebts = MockService.getDebts();
        const allRepayments = MockService.getRepayments();
        const allOrders = MockService.getOrders();

        const getMonthlyStats = () => {
            const months = [];
            const now = new Date();
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthStr = d.toISOString().slice(0, 7);
                const monthLabel = d.toLocaleString('default', { month: 'short' });
                const monthRepayments = allRepayments.filter(r => r.timestamp.startsWith(monthStr)).reduce((sum, r) => sum + r.amount, 0);
                const monthCashSales = allOrders.filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(monthStr)).reduce((sum, o) => sum + o.totalAmount, 0);
                const income = monthRepayments + monthCashSales;
                let costs = 0;
                allOrders.filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(monthStr)).forEach(order => {
                    order.items.forEach(item => {
                        const product = allProducts.find(p => p.id === item.productId);
                        costs += (product?.cost || 0) * item.quantity;
                    });
                });
                months.push({ name: monthLabel, income, expense: costs, profit: income - costs });
            }
            return months;
        };

        const getDebtByCategory = () => {
            const catMap: Record<string, number> = {};
            allDebts.forEach(d => {
                const balance = d.amount - d.paidAmount;
                if (balance > 0) catMap[d.category] = (catMap[d.category] || 0) + balance;
            });
            return Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
        };

        const topDebtors = [...allCustomers].sort((a, b) => b.totalDebt - a.totalDebt).slice(0, 5).map(c => ({ name: c.name, debt: c.totalDebt }));
        const lowStockProducts = [...allProducts].sort((a, b) => a.stock - b.stock).slice(0, 5).map(p => ({ name: p.name, stock: p.stock }));

        return { monthlyData: getMonthlyStats(), categoryData: getDebtByCategory(), topDebtors, lowStockProducts };
    }, [isAdmin]);

    const customerCategoryData = useMemo(() => {
        if (isAdmin) return [];
        const myDebts = MockService.getDebts(user.id);
        const debtsByCategory: Record<string, number> = {};
        myDebts.forEach(d => {
            const balance = d.amount - d.paidAmount;
            if (balance > 0) debtsByCategory[d.category] = (debtsByCategory[d.category] || 0) + balance;
        });
        return Object.entries(debtsByCategory).map(([name, value]) => ({ name, value }));
    }, [isAdmin, user.id]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

    return (
        <div className="space-y-6 pb-[140px]">
            {/* Header with View Toggle */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Business Intelligence</h2>
                    <p className="text-sm text-gray-500">Analyze performance and transaction logs</p>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                    <button 
                        onClick={() => setView('summary')}
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'summary' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <PieChartIcon size={16} className="mr-2" /> Analytics
                    </button>
                    <button 
                        onClick={() => setView('ledger')}
                        className={`flex items-center px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'ledger' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm' : 'text-gray-500'}`}
                    >
                        <List size={16} className="mr-2" /> Ledger Log
                    </button>
                </div>
            </div>

            {view === 'summary' ? (
                <>
                    {/* EXISTING ANALYTICS VIEW */}
                    {isAdmin && adminReportsData && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Revenue & Cost (Last 6 Months)</h3>
                                    <div className="flex gap-4 text-[10px] font-black uppercase tracking-wider">
                                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></div> Income</span>
                                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-500 rounded-sm"></div> Costs</span>
                                        <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-emerald-500 rounded-sm"></div> Profit</span>
                                    </div>
                                </div>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={adminReportsData.monthlyData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-700" />
                                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                                            <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} cursor={{fill: '#f3f4f6'}} />
                                            <Bar dataKey="income" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />
                                            <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Unpaid Receivables</h3>
                                    <div className="h-80">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={adminReportsData.categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                                    {adminReportsData.categoryData.map((e, idx) => (
                                                        <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="none" />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend verticalAlign="bottom" height={36} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Top Balances</h3>
                                    <div className="h-80">
                                         <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={adminReportsData.topDebtors} layout="vertical" margin={{ left: 20 }}>
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontWeight: 500, fontSize: 12}} />
                                                <Tooltip cursor={{fill: 'transparent'}} />
                                                <Bar dataKey="debt" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isAdmin && (
                        <div className="space-y-6">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Debt Breakdown</h3>
                                <div className="h-80">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={customerCategoryData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" label={({ name }) => name}>
                                                {customerCategoryData.map((e, idx) => (
                                                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="none" />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-blue-600 p-8 rounded-2xl text-center shadow-xl">
                                <p className="text-blue-100 mb-2 font-medium">Total Balance</p>
                                <p className="text-5xl font-black text-white">₱{MockService.getDebts(user.id).reduce((s, d) => s + (d.amount - d.paidAmount), 0).toLocaleString()}</p>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* DETAILED LEDGER REPORT VIEW */
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    
                    {/* Period Controls */}
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                            <button onClick={() => setPeriod('today')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${period === 'today' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}>Today</button>
                            <button onClick={() => setPeriod('week')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${period === 'week' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}>7D</button>
                            <button onClick={() => setPeriod('month')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${period === 'month' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}>30D</button>
                            <button onClick={() => setPeriod('year')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${period === 'year' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600' : 'text-gray-500'}`}>Year</button>
                        </div>

                        {isAdmin && (
                            <div className="relative w-full md:w-64">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <select 
                                    value={selectedCustomerId}
                                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium outline-none"
                                >
                                    <option value="all">All Accounts</option>
                                    {MockService.getCustomers().map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="flex gap-2">
                             <button onClick={() => window.print()} className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 shadow-sm"><Printer size={18} /></button>
                             <button className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 shadow-sm"><Download size={18} /></button>
                        </div>
                    </div>

                    {/* Summary Mini Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Opening Bal</p>
                            <p className="text-xl font-black text-gray-900 dark:text-white">₱{ledgerData.openingBalance.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">New Charges</p>
                            <p className="text-xl font-black text-red-600">+₱{ledgerData.totalAdded.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Paid</p>
                            <p className="text-xl font-black text-green-600">-₱{ledgerData.totalPaid.toLocaleString()}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Net Closing</p>
                            <p className="text-xl font-black text-blue-600">₱{ledgerData.closingBalance.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Detailed Transaction List */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-[10px] font-black uppercase text-gray-400 tracking-widest">
                                        <th className="p-4 w-32">Date</th>
                                        {isAdmin && selectedCustomerId === 'all' && <th className="p-4">Account</th>}
                                        <th className="p-4">Particulars</th>
                                        <th className="p-4 text-right">Debit (+)</th>
                                        <th className="p-4 text-right">Credit (-)</th>
                                        <th className="p-4 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    <tr className="bg-blue-50/30 dark:bg-blue-900/10 italic text-gray-500">
                                        <td className="p-4 text-[10px]" colSpan={isAdmin && selectedCustomerId === 'all' ? 3 : 2}>Balance Forward (Before {getPeriodDates(period).start})</td>
                                        <td colSpan={2}></td>
                                        <td className="p-4 text-right font-bold font-mono">₱{ledgerData.openingBalance.toLocaleString()}</td>
                                    </tr>
                                    {ledgerData.transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-gray-400">
                                                No transactions recorded in this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        ledgerData.transactions.map((txn, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-700 dark:text-gray-300">{new Date(txn.date).toLocaleDateString()}</div>
                                                    <div className="text-[10px] text-gray-400">{new Date(txn.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                {isAdmin && selectedCustomerId === 'all' && (
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-black">{getInitials(txn.customerName)}</div>
                                                            <span className="font-bold text-xs truncate max-w-[100px]">{txn.customerName}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="p-4 font-medium text-gray-800 dark:text-gray-200">{txn.particulars}</td>
                                                <td className="p-4 text-right font-mono font-bold text-red-600">{txn.debit > 0 ? `+₱${txn.debit.toLocaleString()}` : ''}</td>
                                                <td className="p-4 text-right font-mono font-bold text-green-600">{txn.credit > 0 ? `-₱${txn.credit.toLocaleString()}` : ''}</td>
                                                <td className="p-4 text-right font-mono font-black text-gray-900 dark:text-white">₱{txn.balance.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                                    <tr className="font-black">
                                        <td className="p-4 uppercase text-[10px] tracking-widest text-gray-400" colSpan={isAdmin && selectedCustomerId === 'all' ? 3 : 2}>Period Totals</td>
                                        <td className="p-4 text-right font-mono text-red-600">+₱{ledgerData.totalAdded.toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-green-600">-₱{ledgerData.totalPaid.toLocaleString()}</td>
                                        <td className="p-4 text-right font-mono text-blue-600">₱{ledgerData.closingBalance.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

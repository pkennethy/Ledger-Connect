import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Language, DICTIONARY, User, UserRole } from '../types';
import { MockService } from '../services/mockData';

interface PageProps {
    lang: Language;
    user: User;
}

export const Reports: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;
    
    // Fetch Data
    const customers = MockService.getCustomers();
    const products = MockService.getProducts();
    const orders = MockService.getOrders();
    const allDebts = MockService.getDebts();

    // --- CHART DATA CALCULATIONS ---

    // 1. Profit Analysis (Last 6 Months)
    const monthlyData = useMemo(() => {
        const data = [];
        const today = new Date();
        
        for (let i = 5; i >= 0; i--) {
            // Get date for i months ago
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const monthStr = d.toISOString().slice(0, 7); // YYYY-MM format
            const monthName = d.toLocaleString('default', { month: 'short' });

            // Filter orders for this month (excluding cancelled)
            const monthOrders = orders.filter(o => o.createdAt.startsWith(monthStr) && o.status !== 'CANCELLED');

            let revenue = 0;
            let cogs = 0; // Cost of Goods Sold

            monthOrders.forEach(order => {
                revenue += order.totalAmount;
                
                // Calculate Cost based on current product cost (Snapshot would be better, but using current for simplicity)
                order.items.forEach(item => {
                    const product = products.find(p => p.id === item.productId);
                    // Use product cost if available, otherwise assume 0 or estimate
                    const unitCost = product ? product.cost : 0; 
                    cogs += (unitCost * item.quantity);
                });
            });

            data.push({
                name: monthName,
                income: revenue,
                expense: cogs,
                profit: revenue - cogs
            });
        }
        return data;
    }, [orders, products]);

    // 2. Top Debtors Leaderboard
    const topDebtors = useMemo(() => {
        return [...customers]
            .filter(c => c.totalDebt > 0)
            .sort((a, b) => b.totalDebt - a.totalDebt)
            .slice(0, 5)
            .map(c => ({ name: c.name, debt: c.totalDebt }));
    }, [customers]);

    // 3. Inventory Data (Low Stock Alert)
    const lowStockProducts = useMemo(() => {
        return [...products]
            .sort((a, b) => a.stock - b.stock)
            .slice(0, 5)
            .map(p => ({ name: p.name, stock: p.stock }));
    }, [products]);

    // 4. Global Debt Category Data (Admin)
    const adminCategoryData = useMemo(() => {
        const catMap: Record<string, number> = {};
        allDebts.forEach(d => {
            const outstanding = d.amount - d.paidAmount;
            if (outstanding > 0) {
                catMap[d.category] = (catMap[d.category] || 0) + outstanding;
            }
        });

        const data = Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); // Sort biggest debt category first
            
        return data.length > 0 ? data : [{ name: 'No Debt', value: 1 }];
    }, [allDebts]);

    // 5. Personal Debt Category Data (Customer)
    const customerCategoryData = useMemo(() => {
        const myDebts = MockService.getDebts(user.id);
        const debtsByCategory: Record<string, number> = {};
        myDebts.forEach(d => {
            const outstanding = d.amount - d.paidAmount;
            if (outstanding > 0) {
                debtsByCategory[d.category] = (debtsByCategory[d.category] || 0) + outstanding;
            }
        });
        
        const data = Object.entries(debtsByCategory)
            .map(([name, value]) => ({ name, value }));

        return data.length > 0 ? data : [{ name: 'Clean', value: 1 }];
    }, [user.id, allDebts]); // Depend on allDebts so it updates when debts change

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

    if (isAdmin) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t.reports}</h2>

                {/* Profit Analysis */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Financial Overview (Revenue vs Cost vs Profit)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{fill: '#9ca3af'}} />
                                <YAxis tick={{fill: '#9ca3af'}} />
                                <Tooltip 
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} 
                                    cursor={{fill: '#f3f4f6'}}
                                    formatter={(value: number) => [`₱${value.toLocaleString()}`, '']}
                                />
                                <Legend />
                                <Bar dataKey="income" fill="#3b82f6" name="Revenue" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" fill="#ef4444" name="Cost (COGS)" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="profit" fill="#10b981" name="Net Profit" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales by Category */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Outstanding Debt Composition</h3>
                        <div className="h-80 w-full flex justify-center">
                            {adminCategoryData.length === 1 && adminCategoryData[0].name === 'No Debt' ? (
                                <div className="flex items-center justify-center text-gray-400 h-full">No outstanding debts to analyze.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={adminCategoryData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            fill="#8884d8"
                                            paddingAngle={5}
                                            dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {adminCategoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Amount']} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Top Debtors Leaderboard */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Top Debtors</h3>
                        <div className="h-80">
                            {topDebtors.length === 0 ? (
                                <div className="flex items-center justify-center text-gray-400 h-full">No debtors found.</div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topDebtors} layout="vertical" margin={{ left: 40, right: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{fill: '#9ca3af', fontWeight: 500}} />
                                        <Tooltip 
                                            cursor={{fill: 'transparent'}}
                                            formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Debt']}
                                        />
                                        <Bar dataKey="debt" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={32} label={{ position: 'right', fill: '#9ca3af', fontSize: 12 }}>
                                            {topDebtors.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f59e0b'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Inventory Low Stock Alert */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-2">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Inventory Alert (Lowest Stock Items)</h3>
                        <div className="h-64">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={lowStockProducts} margin={{ left: 20, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="name" tick={{fill: '#9ca3af'}} />
                                    <YAxis tick={{fill: '#9ca3af'}} />
                                    <Tooltip cursor={{fill: 'transparent'}} />
                                    <Bar dataKey="stock" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={50} name="Units in Stock">
                                         {lowStockProducts.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.stock < 20 ? '#ef4444' : '#6366f1'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Customer View
    const totalMyDebt = MockService.getDebts(user.id).reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t.my_debts} Analysis</h2>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">My Debt Breakdown</h3>
                <div className="h-80 w-full flex justify-center">
                    {customerCategoryData.length === 1 && customerCategoryData[0].name === 'Clean' ? (
                        <div className="flex flex-col items-center justify-center text-gray-400">
                             <p>You have no outstanding debts. Great job!</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={customerCategoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {customerCategoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Amount']} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-2">Total Outstanding Balance</p>
                <p className={`text-4xl font-bold ${totalMyDebt > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    ₱{totalMyDebt.toLocaleString()}
                </p>
            </div>
        </div>
    );
};
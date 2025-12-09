import React from 'react';
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
    
    // Admin Data: Global
    const customers = MockService.getCustomers();
    const products = MockService.getProducts();

    const monthlyData = [
        { name: 'Jan', income: 4000, expense: 2400, profit: 1600 },
        { name: 'Feb', income: 3000, expense: 1398, profit: 1602 },
        { name: 'Mar', income: 2000, expense: 9800, profit: -7800 },
        { name: 'Apr', income: 2780, expense: 3908, profit: -1128 },
        { name: 'May', income: 1890, expense: 4800, profit: -2910 },
        { name: 'Jun', income: 2390, expense: 3800, profit: -1410 },
        { name: 'Jul', income: 6500, expense: 2000, profit: 4500 },
        { name: 'Aug', income: 5100, expense: 2300, profit: 2800 },
    ];
    const topDebtors = [...customers]
        .sort((a, b) => b.totalDebt - a.totalDebt)
        .slice(0, 5)
        .map(c => ({ name: c.name, debt: c.totalDebt }));

    // Inventory Data (Low Stock Alert)
    const lowStockProducts = products
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5)
        .map(p => ({ name: p.name, stock: p.stock }));

    // Customer Data: Personal
    const myDebts = MockService.getDebts(user.id);
    const debtsByCategory: Record<string, number> = {};
    myDebts.forEach(d => {
        debtsByCategory[d.category] = (debtsByCategory[d.category] || 0) + (d.amount - d.paidAmount);
    });
    
    const customerCategoryData = Object.entries(debtsByCategory)
        .filter(([_, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));

    // Default chart data fallback
    const displayCategoryData = customerCategoryData.length > 0 ? customerCategoryData : [{ name: 'No Debt', value: 1 }];
    
    // Global Category Data (Mock)
    const adminCategoryData = [
        { name: 'Grains', value: 40000 },
        { name: 'Fruits', value: 30000 },
        { name: 'Canned', value: 30000 },
        { name: 'Dry Goods', value: 20000 },
    ];

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    if (isAdmin) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t.reports}</h2>

                {/* Profit Analysis */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Profit Analysis (Income vs Expense vs Profit)</h3>
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="name" tick={{fill: '#9ca3af'}} />
                                <YAxis tick={{fill: '#9ca3af'}} />
                                <Tooltip 
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} 
                                    cursor={{fill: '#f3f4f6'}} 
                                />
                                <Legend />
                                <Bar dataKey="income" fill="#3b82f6" name="Income" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="expense" fill="#ef4444" name="Costs" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="profit" fill="#10b981" name="Net Profit" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales by Category */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Debt Composition by Category</h3>
                        <div className="h-80">
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
                                    >
                                        {adminCategoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top Debtors Leaderboard */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Customer Debt Leaderboard</h3>
                        <div className="h-80">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topDebtors} layout="vertical" margin={{ left: 40 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fill: '#9ca3af', fontWeight: 500}} />
                                    <Tooltip cursor={{fill: 'transparent'}} />
                                    <Bar dataKey="debt" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={32} label={{ position: 'right', fill: '#9ca3af', fontSize: 12 }}>
                                        {topDebtors.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#f59e0b'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Inventory Low Stock Alert */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-2">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">Inventory Status (Lowest Stock Items)</h3>
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
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t.my_debts} Analysis</h2>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">My Debt Breakdown</h3>
                <div className="h-80 w-full flex justify-center">
                    {customerCategoryData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-gray-400">
                             <p>No active debts to analyze.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={displayCategoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={120}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {displayCategoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800 text-center">
                <p className="text-gray-600 dark:text-gray-300 mb-2">Total Outstanding Balance</p>
                <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">
                    ₱{myDebts.reduce((sum, d) => sum + (d.amount - d.paidAmount), 0).toLocaleString()}
                </p>
            </div>
        </div>
    );
};
import React, { useState, useEffect } from 'react';
import { Search, Plus, Phone, MapPin, MoreVertical, X, User as UserIcon, Trash2, Edit, Mail, History, ShoppingBag, ArrowDownLeft, ArrowUpRight, FileText, Image, LayoutGrid, LayoutList, Wallet, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, Customer, User, UserRole } from '../types';
import { useToast } from '../context/ToastContext';

interface PageProps {
    lang: Language;
    user?: User;
}

export const Customers: React.FC<PageProps> = ({ lang, user }) => {
    // Security Guard: Redirect customers to dashboard if they try to access this page
    if (user?.role === UserRole.CUSTOMER) {
        return <Navigate to="/" replace />;
    }

    const t = DICTIONARY[lang];
    const { showToast } = useToast();
    const navigate = useNavigate();
    
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

    // Customer Form State (for both Add and Edit)
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({ name: '', phone: '', address: '', email: '', avatarUrl: '' });
    
    // Force refresh hack since we're using mock data without global state
    const [refresh, setRefresh] = useState(0); 
    
    const allCustomers = MockService.getCustomers().filter(c => c.role !== UserRole.ADMIN);
    const filteredCustomers = allCustomers.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const paginatedCustomers = filteredCustomers.slice(
        (currentPage - 1) * itemsPerPage, 
        currentPage * itemsPerPage
    );

    const handleOpenAdd = () => {
        setEditingCustomer(null);
        setFormData({ name: '', phone: '', address: '', email: '', avatarUrl: '' });
        setShowAddModal(true);
    };

    const handleOpenEdit = (customer: Customer, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingCustomer(customer);
        setFormData({ 
            name: customer.name, 
            phone: customer.phone, 
            address: customer.address,
            email: customer.email || '',
            avatarUrl: customer.avatarUrl || ''
        });
        setShowAddModal(true);
    };

    const handleDelete = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if(confirm('Are you sure you want to delete this customer? This action cannot be undone.')) {
            MockService.deleteCustomer(id);
            setRefresh(prev => prev + 1);
            showToast('Customer deleted', 'error');
        }
    };

    const handleSubmit = () => {
        if (!formData.name || !formData.phone || !formData.email) {
            showToast('Name, Phone, and Email are required', 'error');
            return;
        }

        // Basic Email Validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            showToast('Please enter a valid email address', 'error');
            return;
        }
        
        const avatarToUse = formData.avatarUrl || `https://ui-avatars.com/api/?name=${formData.name}&background=random`;

        if (editingCustomer) {
            // Update
            MockService.updateCustomer(editingCustomer.id, {
                name: formData.name,
                phone: formData.phone,
                address: formData.address,
                email: formData.email,
                avatarUrl: avatarToUse
            });
            showToast('Customer profile updated', 'success');
        } else {
            // Create
            MockService.addCustomer({
                id: `c-${Date.now()}`,
                name: formData.name,
                phone: formData.phone,
                address: formData.address || 'Philippines',
                avatarUrl: avatarToUse,
                totalDebt: 0,
                email: formData.email,
                role: UserRole.CUSTOMER
            });
            showToast('New customer registered', 'success');
        }
        
        setShowAddModal(false);
        setFormData({ name: '', phone: '', address: '', email: '', avatarUrl: '' });
        setEditingCustomer(null);
        setRefresh(prev => prev + 1);
    };

    const handleViewHistory = (customer: Customer, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setHistoryCustomer(customer);
        setShowHistoryModal(true);
    };

    // Helper reused for local date calculation (duplicated to avoid export issues across files)
    const getLocalDateFromISO = (isoDate: string) => {
        const d = new Date(isoDate);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleSendSMS = (customer: Customer, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!customer.phone) {
            showToast(`No phone number for ${customer.name}`, 'error');
            return;
        }

        // Default to Today for Quick Action
        const targetDate = getTodayString();
        
        // Format for display
        const dateObj = new Date(targetDate);
        const dateDisplay = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        const rawDebts = MockService.getDebts(customer.id);
        const rawPayments = MockService.getRepayments(customer.id);

        // 3. Get Unique Categories involved
        const categories = Array.from(new Set([
            ...rawDebts.map(d => d.category),
            ...rawPayments.map(p => p.category)
        ])).sort();

        let grandTotal = 0;
        const breakdownLines: string[] = [];

        // 4. Per-Category Calculation
        categories.forEach(cat => {
            // Split based on date
            // Previous: Strictly less than targetDate
            const prevDebts = rawDebts.filter(d => d.category === cat && getLocalDateFromISO(d.createdAt) < targetDate);
            const prevPayments = rawPayments.filter(p => p.category === cat && getLocalDateFromISO(p.timestamp) < targetDate);
            
            const prevBal = prevDebts.reduce((sum, d) => sum + d.amount, 0) - prevPayments.reduce((sum, p) => sum + p.amount, 0);

            // Current: Equal to targetDate
            const currDebts = rawDebts.filter(d => d.category === cat && getLocalDateFromISO(d.createdAt) === targetDate);
            const currPayments = rawPayments.filter(p => p.category === cat && getLocalDateFromISO(p.timestamp) === targetDate);

            // Group items for display
            // Accumulate quantity AND total price per product
            const productMap: Record<string, {qty: number, val: number}> = {};
            currDebts.forEach(d => {
                d.items.forEach(i => {
                    const itemTotal = i.price * i.quantity;
                    if (!productMap[i.productName]) {
                        productMap[i.productName] = { qty: 0, val: 0 };
                    }
                    productMap[i.productName].qty += i.quantity;
                    productMap[i.productName].val += itemTotal;
                });
            });

            const totalNewCharges = currDebts.reduce((sum, d) => sum + d.amount, 0);
            const totalNewPayments = currPayments.reduce((sum, p) => sum + p.amount, 0);
            
            const endBal = prevBal + totalNewCharges - totalNewPayments;

            // Only display category if there's activity or a balance
            if (Math.abs(endBal) > 0.01 || totalNewCharges > 0 || totalNewPayments > 0) {
                breakdownLines.push(`[${cat}]`);
                
                if (Math.abs(prevBal) > 0.01) {
                    breakdownLines.push(`  Beg: P${prevBal.toLocaleString()}`);
                }

                // Sort by value and display with quantity
                Object.entries(productMap)
                    .sort((a,b) => b[1].val - a[1].val)
                    .forEach(([name, data]) => {
                        breakdownLines.push(`  + ${name} (x${data.qty}): P${data.val.toLocaleString()}`);
                    });

                // List individual payments instead of sum
                currPayments.forEach(p => {
                    breakdownLines.push(`  - Paid: P${p.amount.toLocaleString()}`);
                });

                breakdownLines.push(`  = End: P${endBal.toLocaleString()}`);
                grandTotal += endBal;
            }
        });

        const breakdown = breakdownLines.join('\n');

        let message = `SOA\n${dateDisplay}\n\nTo: ${customer.name}\n\nTOTAL DUE: P${grandTotal.toLocaleString()}`;

        if (breakdown) {
            message += `\n\nDETAILS:\n${breakdown}`;
        }
        
        message += `\n\n- Ledger Connect`;

        // Determine separator based on OS
        const ua = navigator.userAgent.toLowerCase();
        const isiOS = /iphone|ipad|ipod/.test(ua);
        const separator = isiOS ? '&' : '?';

        // Clean phone number
        const cleanPhone = customer.phone.replace(/[^0-9+]/g, '');

        window.location.href = `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
    };

    // Helper to get combined transactions
    const getCustomerTransactions = (customerId: string) => {
        const orders = MockService.getOrders(customerId).map(o => ({
            id: o.id,
            type: 'ORDER',
            date: o.createdAt,
            amount: o.totalAmount,
            description: `Order #${o.id.replace('ord-', '')} (${o.items.length} items)`,
            status: o.status
        }));
        
        const payments = MockService.getRepayments(customerId).map(p => ({
            id: p.id,
            type: 'PAYMENT',
            date: p.timestamp,
            amount: p.amount,
            description: `Payment - ${p.category}`,
            status: 'COMPLETED'
        }));

        const manualDebts = MockService.getDebts(customerId)
            .filter(d => d.orderId === 'manual' || (d.orderId && d.orderId.includes('man')))
            .map(d => ({
                id: d.id,
                type: 'DEBT_ADJ',
                date: d.createdAt,
                amount: d.amount,
                description: `Manual Charge: ${d.category}`,
                status: d.status
            }));

        return [...orders, ...payments, ...manualDebts].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    };

    return (
        <div className="space-y-2 pb-20">
            {/* STICKY HEADER WRAPPER */}
            <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md -mx-4 px-4 pt-1 pb-2 shadow-sm transition-all">
                {/* Header Controls */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            {t.customers}
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{filteredCustomers.length}</span>
                        </h2>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                         {/* Search */}
                        <div className="relative flex-1 xl:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search customers..." 
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* View Toggle */}
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><LayoutList size={18} /></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><LayoutGrid size={18} /></button>
                        </div>

                        {/* Actions */}
                        {/* Removed CSV Import Here */}
                        <button onClick={handleOpenAdd} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700 shadow-sm"><Plus size={16} className="mr-1" /> Add</button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {paginatedCustomers.length === 0 ? (
                 <div className="flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 min-h-[300px]">
                    <UserIcon size={48} className="mb-2 opacity-50" />
                    <p>No customers found</p>
                </div>
            ) : viewMode === 'list' ? (
                 // --- TABLE VIEW ---
                 <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Customer</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Contact</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Debt Status</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paginatedCustomers.map(customer => (
                                    <tr 
                                        key={customer.id} 
                                        onClick={() => handleViewHistory(customer)}
                                        className="hover:bg-blue-50/30 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-2">
                                            <div className="flex items-center">
                                                <img src={customer.avatarUrl} className="w-8 h-8 rounded-full object-cover border border-gray-100 mr-3" alt="" />
                                                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{customer.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="flex flex-col text-xs text-gray-500">
                                                <span>{customer.phone}</span>
                                                <span className="truncate max-w-[150px]">{customer.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                             <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                customer.totalDebt > 0 
                                                ? 'text-red-600 bg-red-50 border-red-200' 
                                                : 'text-green-600 bg-green-50 border-green-200'
                                            }`}>
                                                {customer.totalDebt > 0 ? `Debt: ₱${customer.totalDebt.toLocaleString()}` : 'Good Standing'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button onClick={(e) => handleSendSMS(customer, e)} className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Send SMS"><MessageSquare size={14} /></button>
                                                <button onClick={(e) => handleOpenEdit(customer, e)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit size={14} /></button>
                                                <button onClick={(e) => handleDelete(customer.id, e)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                // --- GRID VIEW (Immersive) ---
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
                     {paginatedCustomers.map(customer => (
                        <div 
                            key={customer.id} 
                            onClick={() => handleViewHistory(customer)}
                            className="relative aspect-square bg-gray-200 rounded-xl overflow-hidden group shadow-sm cursor-pointer"
                        >
                            {/* Full Image */}
                            <img 
                                src={customer.avatarUrl} 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                alt={customer.name} 
                            />
                            
                            {/* Gradient Overlay */}
                            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                             {/* Top Right Actions */}
                             <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button onClick={(e) => handleSendSMS(customer, e)} className="bg-white/90 p-1.5 rounded-full text-green-600 shadow-sm backdrop-blur-sm hover:scale-110 transition-transform" title="SMS Reminder"><MessageSquare size={14} /></button>
                                <button onClick={(e) => handleOpenEdit(customer, e)} className="bg-white/90 p-1.5 rounded-full text-blue-600 shadow-sm backdrop-blur-sm hover:scale-110 transition-transform"><Edit size={14} /></button>
                                <button onClick={(e) => handleDelete(customer.id, e)} className="bg-white/90 p-1.5 rounded-full text-red-600 shadow-sm backdrop-blur-sm hover:scale-110 transition-transform"><Trash2 size={14} /></button>
                            </div>

                            {/* Debt Badge (Top Left) */}
                            <div className={`absolute top-2 left-2 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm z-10 uppercase tracking-wider ${
                                customer.totalDebt > 0 ? 'bg-red-600/90' : 'bg-green-600/90'
                            }`}>
                                {customer.totalDebt > 0 ? `Debt: ₱${customer.totalDebt}` : 'Clean'}
                            </div>

                             {/* Content Overlay */}
                             <div className="absolute bottom-0 left-0 w-full p-3 flex items-end justify-between gap-2 z-10">
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-bold text-lg leading-none mb-1 drop-shadow-md truncate">{customer.name}</div>
                                    <div className="flex items-center text-white/80 text-[10px] font-medium">
                                        <Phone size={10} className="mr-1" />
                                        {customer.phone}
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={(e) => handleViewHistory(customer, e)}
                                    className="bg-white/20 hover:bg-white/30 text-white border border-white/40 p-2 rounded-full backdrop-blur-md shadow-lg transition-all active:scale-95 shrink-0"
                                >
                                    <History size={18} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                     ))}
                </div>
            )}

            {/* Pagination Controls */}
            {filteredCustomers.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredCustomers.length)}</span> of <span className="font-bold">{filteredCustomers.length}</span> customers
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={16} className="text-gray-600 dark:text-gray-300" />
                        </button>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center px-2">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={16} className="text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && historyCustomer && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <div className="flex items-center">
                                <img src={historyCustomer.avatarUrl} className="w-10 h-10 rounded-full border border-gray-100 mr-3" alt="" />
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                        {historyCustomer.name}
                                    </h3>
                                    <p className="text-xs text-gray-500">Transaction History</p>
                                </div>
                            </div>
                            <button onClick={() => setShowHistoryModal(false)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        
                        <div className="overflow-y-auto flex-1 pr-2 space-y-3">
                            {getCustomerTransactions(historyCustomer.id).length === 0 ? (
                                <div className="text-center py-10 text-gray-400">
                                    <FileText size={48} className="mx-auto mb-2 opacity-50" />
                                    <p>No transactions found</p>
                                </div>
                            ) : (
                                getCustomerTransactions(historyCustomer.id).map((tx, idx) => (
                                    <div key={idx} className="flex items-center p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <div className={`p-2 rounded-full mr-4 shrink-0 ${
                                            tx.type === 'PAYMENT' 
                                            ? 'bg-green-100 text-green-600' 
                                            : tx.type === 'DEBT_ADJ' 
                                            ? 'bg-red-100 text-red-600'
                                            : 'bg-blue-100 text-blue-600'
                                        }`}>
                                            {tx.type === 'PAYMENT' ? <ArrowDownLeft size={20} /> : 
                                             tx.type === 'DEBT_ADJ' ? <ArrowUpRight size={20} /> : 
                                             <ShoppingBag size={20} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-gray-800 dark:text-gray-200">{tx.description}</h4>
                                                <span className={`font-mono font-bold ${
                                                    tx.type === 'PAYMENT' ? 'text-green-600' : 'text-gray-800 dark:text-white'
                                                }`}>
                                                    {tx.type === 'PAYMENT' ? '-' : '+'}₱{tx.amount.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-xs text-gray-500">{new Date(tx.date).toLocaleString()}</span>
                                                <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                                                    tx.status === 'COMPLETED' || tx.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {tx.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                            <button 
                                onClick={() => navigate('/debts')}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700"
                            >
                                <Wallet size={16} className="mr-2" />
                                Manage Debt
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Customer Modal - Z-INDEX 60 to top Ad Banner */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                                {editingCustomer ? 'Edit Customer' : 'Register New Customer'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                                <div className="relative">
                                    <UserIcon size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="text"
                                        className="w-full pl-10 p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="e.g. Juan dela Cruz"
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile Number *</label>
                                <div className="relative">
                                    <Phone size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="text"
                                        className="w-full pl-10 p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="+63 900 000 0000"
                                        value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address *</label>
                                <div className="relative">
                                    <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="email"
                                        className="w-full pl-10 p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="customer@example.com"
                                        value={formData.email}
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Required for sending debt summaries.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                                <div className="relative">
                                    <MapPin size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="text"
                                        className="w-full pl-10 p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="City, Province"
                                        value={formData.address}
                                        onChange={e => setFormData({...formData, address: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Image URL (Optional)</label>
                                <div className="relative">
                                    <Image size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="text"
                                        className="w-full pl-10 p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="https://example.com/photo.jpg"
                                        value={formData.avatarUrl}
                                        onChange={e => setFormData({...formData, avatarUrl: e.target.value})}
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleSubmit}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 mt-2 shadow-lg"
                            >
                                {editingCustomer ? 'Update Profile' : 'Create Customer Profile'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
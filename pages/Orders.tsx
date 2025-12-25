
import React, { useState, useMemo, useEffect } from 'react';
import { Clock, CheckCircle, Truck, Package, XCircle, Search, Eye, X, Printer, ArrowRight, ChevronLeft, ChevronRight, RefreshCw, Layers, ClipboardList } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, OrderStatus, User, UserRole, Order } from '../types';
import { useToast } from '../context/ToastContext';

interface PageProps {
    lang: Language;
    user?: User; 
}

export const Orders: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const { showToast } = useToast();
    const [refresh, setRefresh] = useState(0); 
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    const [showDebtAssignModal, setShowDebtAssignModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);
    const [debtAssignments, setDebtAssignments] = useState<Record<string, string>>({});

    const isCustomer = user?.role === UserRole.CUSTOMER;
    
    const allOrders = useMemo(() => {
        return isCustomer 
            ? MockService.getOrders(user.id) 
            : MockService.getOrders();
    }, [isCustomer, user?.id, refresh]);

    const filteredOrders = useMemo(() => {
        return allOrders.filter(o => 
            o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
            o.id.includes(searchTerm)
        );
    }, [allOrders, searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const products = MockService.getProducts();

    const allDebtCategories = useMemo(() => {
        const cats = new Set<string>();
        MockService.getDebts().forEach(d => cats.add(d.category));
        products.forEach(p => cats.add(p.category));
        return Array.from(cats).sort();
    }, [products, refresh]);

    const getProductImage = (productId: string) => {
        return products.find(p => p.id === productId)?.imageUrl || 'https://via.placeholder.com/50';
    };

    const getStatusColor = (status: OrderStatus) => {
        switch (status) {
            case OrderStatus.PENDING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case OrderStatus.CONFIRMED: return 'bg-blue-100 text-blue-800 border-blue-200';
            case OrderStatus.DELIVERING: return 'bg-purple-100 text-purple-800 border-purple-200';
            case OrderStatus.COMPLETED: return 'bg-green-100 text-green-800 border-green-200';
            case OrderStatus.CANCELLED: return 'bg-gray-100 text-gray-600 border-gray-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const handleUpdateStatus = (id: string, newStatus: OrderStatus) => {
        if (newStatus === OrderStatus.CONFIRMED) {
             const orderToConfirm = allOrders.find(o => o.id === id);
             if (orderToConfirm) {
                 setConfirmingOrder(orderToConfirm);
                 const initialAssignments: Record<string, string> = {};
                 orderToConfirm.items.forEach(item => {
                     const lastCat = MockService.getLastUsedCategory(orderToConfirm.customerId, item.productId);
                     initialAssignments[item.productId] = lastCat || item.category;
                 });
                 setDebtAssignments(initialAssignments);
                 setShowDebtAssignModal(true);
                 setIsSubmitting(false);
             }
        } else {
            MockService.updateOrder(id, { status: newStatus });
            setRefresh(prev => prev + 1);
            showToast(`Order updated`, 'info');
            if (selectedOrder) setSelectedOrder({...selectedOrder, status: newStatus});
        }
    };

    const confirmOrderProcess = async () => {
        if (!confirmingOrder || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await MockService.confirmOrder(confirmingOrder.id, debtAssignments);
            setRefresh(r=>r+1);
            setShowDebtAssignModal(false);
            setConfirmingOrder(null);
            setSelectedOrder(null);
            showToast('Confirmed', 'success');
        } catch (e) {
            showToast('Error confirming order', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 pb-[140px]">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-tight">{isCustomer ? t.my_orders : t.orders}</h2>
                {!isCustomer && (
                     <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search orders..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white font-bold"
                        />
                    </div>
                )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest">
                                <th className="p-4">Order ID</th>
                                {!isCustomer && <th className="p-4">Customer</th>}
                                <th className="p-4">Status</th>
                                <th className="p-4">Total</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginatedOrders.length === 0 ? (
                                <tr><td colSpan={7} className="p-12 text-center text-gray-400 font-bold italic">No orders found.</td></tr>
                            ) : (
                                paginatedOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                        <td className="p-4 text-sm font-black font-mono">#{order.id.slice(-6).toUpperCase()}</td>
                                        {!isCustomer && <td className="p-4 text-sm font-bold">{order.customerName}</td>}
                                        <td className="p-4"><span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${getStatusColor(order.status)}`}>{order.status}</span></td>
                                        <td className="p-4 text-sm font-black font-mono">₱{order.totalAmount.toLocaleString()}</td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button onClick={() => setSelectedOrder(order)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-gray-50 dark:bg-gray-700 rounded-lg"><Eye size={18} /></button>
                                            {!isCustomer && order.status === OrderStatus.PENDING && (
                                                <button onClick={() => handleUpdateStatus(order.id, OrderStatus.CONFIRMED)} className="px-4 py-2 bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-sm active:scale-95">Confirm</button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredOrders.length > 0 && (
                    <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</div>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border dark:border-gray-700 rounded-xl disabled:opacity-30 hover:bg-gray-200 transition-all"><ChevronLeft size={16} /></button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 border dark:border-gray-700 rounded-xl disabled:opacity-30 hover:bg-gray-200 transition-all"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>

            {showDebtAssignModal && confirmingOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                         <div className="bg-indigo-600 p-6 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <Layers size={20} strokeWidth={3} />
                                <h3 className="text-sm font-black uppercase tracking-tight">Assign Debt Categories</h3>
                            </div>
                            <button onClick={() => setShowDebtAssignModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20}/></button>
                         </div>
                         <div className="p-8 flex-1 overflow-y-auto space-y-4 max-h-[60vh]">
                             {confirmingOrder.items.map(item => (
                                 <div key={item.productId} className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-2xl border dark:border-slate-800 shadow-inner">
                                     <img src={getProductImage(item.productId)} className="w-14 h-14 rounded-xl object-cover shadow-sm" alt="" />
                                     <div className="flex-1 min-w-0">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-bold text-sm truncate pr-2">{item.productName}</span>
                                            <span className="text-[10px] font-black text-blue-600 uppercase">x{item.quantity}</span>
                                        </div>
                                        <input 
                                            type="text" 
                                            list="debt-categories-orders" 
                                            className="w-full text-xs p-3 rounded-xl border dark:border-slate-700 dark:bg-slate-950 font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all" 
                                            placeholder="Choose Ledger Category..." 
                                            value={debtAssignments[item.productId] || ''} 
                                            onChange={(e) => setDebtAssignments({...debtAssignments, [item.productId]: e.target.value})} 
                                        />
                                    </div>
                                 </div>
                             ))}
                             <datalist id="debt-categories-orders">{allDebtCategories.map(cat => <option key={cat} value={cat} />)}</datalist>
                        </div>
                        <div className="p-8 bg-gray-50 dark:bg-slate-950 border-t dark:border-slate-800 shrink-0">
                            <button 
                                onClick={confirmOrderProcess} 
                                disabled={isSubmitting}
                                className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
                            >
                                {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                {isSubmitting ? 'Finalizing...' : 'Confirm & Commit to Ledger'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <Package size={20} strokeWidth={3} />
                                <h3 className="text-sm font-black uppercase tracking-tight">Order Record</h3>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={20} /></button>
                        </div>
                        <div className="p-8 overflow-y-auto">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer</p>
                                    <p className="font-black text-xl text-gray-800 dark:text-white uppercase leading-none">{selectedOrder.customerName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Created</p>
                                    <p className="text-xs font-bold text-gray-600 dark:text-slate-400">{new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="border dark:border-slate-800 rounded-2xl overflow-hidden mb-8 shadow-inner">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-slate-950/50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Item</th>
                                            <th className="px-4 py-3 text-center">Qty</th>
                                            <th className="px-4 py-3 text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {selectedOrder.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 py-4 font-bold text-gray-800 dark:text-slate-200">{item.productName}</td>
                                                <td className="px-4 py-4 text-center font-mono font-bold text-blue-600">x{item.quantity}</td>
                                                <td className="px-4 py-4 text-right font-mono font-bold">₱{item.price * item.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-blue-50/30 dark:bg-blue-900/10 font-black">
                                        <tr>
                                            <td colSpan={2} className="px-4 py-4 text-right text-[10px] text-gray-400 uppercase tracking-widest">Grand Total</td>
                                            <td className="px-4 py-4 text-right text-lg font-mono">₱{selectedOrder.totalAmount.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                            <div className="flex gap-4 items-center">
                                <div className={`flex-1 px-4 py-4 rounded-xl text-center text-[10px] font-black uppercase tracking-widest border ${getStatusColor(selectedOrder.status)}`}>
                                    {selectedOrder.status}
                                </div>
                                <button onClick={() => window.print()} className="px-6 py-4 bg-gray-100 dark:bg-slate-800 dark:text-white rounded-xl flex items-center font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all shadow-sm">
                                    <Printer size={16} className="mr-2" /> Print Receipt
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

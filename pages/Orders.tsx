
import React, { useState, useMemo, useEffect } from 'react';
import { Clock, CheckCircle, Truck, Package, XCircle, Search, Eye, X, Printer, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, OrderStatus, User, UserRole, Order } from '../types';
import { useToast } from '../context/ToastContext';

interface PageProps {
    lang: Language;
    user?: User; // Optional to support existing route
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
             }
        } else {
            MockService.updateOrder(id, { status: newStatus });
            setRefresh(prev => prev + 1);
            showToast(`Order updated`, 'info');
            if (selectedOrder) setSelectedOrder({...selectedOrder, status: newStatus});
        }
    };

    return (
        <div className="space-y-6 pb-[140px]">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{isCustomer ? t.my_orders : t.orders}</h2>
                {!isCustomer && (
                     <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search orders..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-10 py-2 rounded-lg bg-white border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-semibold">Order ID</th>
                                {!isCustomer && <th className="p-4 font-semibold">Customer</th>}
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold">Total</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginatedOrders.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No orders found.</td></tr>
                            ) : (
                                paginatedOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="p-4 text-sm font-medium">#{order.id.replace('ord-', '')}</td>
                                        {!isCustomer && <td className="p-4 text-sm">{order.customerName}</td>}
                                        <td className="p-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>{order.status}</span></td>
                                        <td className="p-4 text-sm font-bold">₱{order.totalAmount.toLocaleString()}</td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button onClick={() => setSelectedOrder(order)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"><Eye size={18} /></button>
                                            {!isCustomer && order.status === OrderStatus.PENDING && (
                                                <button onClick={() => handleUpdateStatus(order.id, OrderStatus.CONFIRMED)} className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded border border-green-200 transition-colors">Confirm</button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredOrders.length > 0 && (
                    <div className="px-4 py-3 border-t flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                        <div className="text-xs text-gray-500">Page {currentPage} of {totalPages}</div>
                        <div className="flex gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50"><ChevronLeft size={16} /></button>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>

            {showDebtAssignModal && confirmingOrder && (
                <div className="fixed inset-0 bg-black/60 z-[90] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 flex flex-col">
                         <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0"><div><h3 className="text-xl font-bold">Assign Categories</h3></div><button onClick={() => setShowDebtAssignModal(false)}><X size={20}/></button></div>
                         <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                             {confirmingOrder.items.map(item => (
                                 <div key={item.productId} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                     <img src={getProductImage(item.productId)} className="w-12 h-12 rounded object-cover" alt="" />
                                     <div className="flex-1"><div className="flex justify-between mb-1"><span className="font-bold text-sm">{item.productName}</span><span className="text-xs font-bold text-gray-500">x{item.quantity}</span></div><input type="text" list="debt-categories-orders" className="w-full text-xs p-2 rounded border" placeholder="Debt Category..." value={debtAssignments[item.productId] || ''} onChange={(e) => setDebtAssignments({...debtAssignments, [item.productId]: e.target.value})} /></div>
                                 </div>
                             ))}
                             <datalist id="debt-categories-orders">{allDebtCategories.map(cat => <option key={cat} value={cat} />)}</datalist>
                        </div>
                        <div className="pt-4 border-t shrink-0"><button onClick={() => { MockService.confirmOrder(confirmingOrder.id, debtAssignments); setRefresh(r=>r+1); setShowDebtAssignModal(false); setSelectedOrder(null); showToast('Confirmed', 'success'); }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Confirm & Add to Debt</button></div>
                    </div>
                </div>
            )}

            {selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50"><h3 className="text-lg font-bold">Order Details</h3><button onClick={() => setSelectedOrder(null)}><X size={20} /></button></div>
                        <div className="p-6 overflow-y-auto">
                            <div className="flex justify-between items-start mb-6"><div><p className="text-sm text-gray-500">Customer</p><p className="font-bold text-lg">{selectedOrder.customerName}</p></div><div className="text-right"><p className="text-sm text-gray-500">Date</p><p className="font-medium">{new Date(selectedOrder.createdAt).toLocaleString()}</p></div></div>
                            <div className="border rounded-lg overflow-hidden mb-6"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-4 py-2 text-left">Item</th><th className="px-4 py-2 text-center">Qty</th><th className="px-4 py-2 text-right">Price</th></tr></thead><tbody className="divide-y">{selectedOrder.items.map((item, idx) => (<tr key={idx}><td className="px-4 py-3">{item.productName}</td><td className="px-4 py-3 text-center">{item.quantity}</td><td className="px-4 py-3 text-right">₱{item.price * item.quantity}</td></tr>))}</tbody><tfoot className="bg-gray-50 font-bold"><tr><td colSpan={2} className="px-4 py-3 text-right">Grand Total</td><td className="px-4 py-3 text-right">₱{selectedOrder.totalAmount.toLocaleString()}</td></tr></tfoot></table></div>
                            <div className="flex justify-between items-center"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedOrder.status)}`}>{selectedOrder.status}</span><button onClick={() => window.print()} className="bg-gray-100 px-4 py-2 rounded-lg flex items-center"><Printer size={16} className="mr-2" /> Print</button></div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

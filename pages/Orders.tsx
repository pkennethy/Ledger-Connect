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
    const [refresh, setRefresh] = useState(0); // Trigger re-render
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    
    // New State for Debt Assignment Modal
    const [showDebtAssignModal, setShowDebtAssignModal] = useState(false);
    const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);
    const [debtAssignments, setDebtAssignments] = useState<Record<string, string>>({});

    // If user is provided and is CUSTOMER, only show their orders
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

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Calculate Pagination
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const paginatedOrders = filteredOrders.slice(
        (currentPage - 1) * itemsPerPage, 
        currentPage * itemsPerPage
    );

    const products = MockService.getProducts();

    // Memoize category suggestions
    const allDebtCategories = useMemo(() => {
        const cats = new Set<string>();
        MockService.getDebts().forEach(d => cats.add(d.category));
        products.forEach(p => cats.add(p.category));
        return Array.from(cats).sort();
    }, [products, refresh]);

    // Helper to get product image by ID (since OrderItem doesn't store it)
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
             // NEW: Intercept Confirmation to show Category Modal
             const orderToConfirm = allOrders.find(o => o.id === id);
             if (orderToConfirm) {
                 setConfirmingOrder(orderToConfirm);
                 // Pre-fill assignments with intelligent defaults (Last used category for this customer)
                 const initialAssignments: Record<string, string> = {};
                 orderToConfirm.items.forEach(item => {
                     const lastCat = MockService.getLastUsedCategory(orderToConfirm.customerId, item.productId);
                     initialAssignments[item.productId] = lastCat || item.category;
                 });
                 setDebtAssignments(initialAssignments);
                 setShowDebtAssignModal(true);
             }
        } else {
            // General Status Update
            MockService.updateOrder(id, { status: newStatus });
            setRefresh(prev => prev + 1);
            showToast(`Order #${id} updated to ${newStatus}`, 'info');
            if (selectedOrder) setSelectedOrder({...selectedOrder, status: newStatus});
        }
    };

    const handleConfirmDebtAssignment = () => {
        if (!confirmingOrder) return;
        
        MockService.confirmOrder(confirmingOrder.id, debtAssignments);
        setRefresh(prev => prev + 1);
        showToast(`Order #${confirmingOrder.id} confirmed and added to Ledger`, 'success');
        
        setShowDebtAssignModal(false);
        setConfirmingOrder(null);
        setSelectedOrder(null); // Close details modal if open
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 pb-20">
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
                            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
                        />
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
                                <th className="p-4 font-semibold">Items</th>
                                <th className="p-4 font-semibold">Total</th>
                                <th className="p-4 font-semibold">Date</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginatedOrders.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No orders found.</td></tr>
                            ) : (
                                paginatedOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <td className="p-4 text-sm font-medium text-gray-900 dark:text-gray-200">#{order.id.replace('ord-', '')}</td>
                                        {!isCustomer && <td className="p-4 text-sm text-gray-700 dark:text-gray-300">{order.customerName}</td>}
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                            {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                                        </td>
                                        <td className="p-4 text-sm font-bold text-gray-900 dark:text-gray-100">₱{order.totalAmount.toLocaleString()}</td>
                                        <td className="p-4 text-sm text-gray-500 dark:text-gray-400">{new Date(order.createdAt).toLocaleDateString()}</td>
                                        <td className="p-4 text-right space-x-2 flex justify-end">
                                            <button 
                                                onClick={() => setSelectedOrder(order)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                title="View Details"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            {!isCustomer && order.status === OrderStatus.PENDING && (
                                                <button 
                                                    onClick={() => handleUpdateStatus(order.id, OrderStatus.CONFIRMED)}
                                                    className="inline-flex items-center px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded hover:bg-green-100 border border-green-200 transition-colors"
                                                >
                                                    <CheckCircle size={14} className="mr-1" /> Confirm
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredOrders.length > 0 && (
                    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                            Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> of <span className="font-bold">{filteredOrders.length}</span> orders
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
            </div>

            {/* Debt Category Assignment Modal (Confirmation Flow) */}
            {showDebtAssignModal && confirmingOrder && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                         <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4 shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Confirm Order & Create Debt</h3>
                                <p className="text-xs text-gray-500">Assign categories for each item before adding to ledger.</p>
                            </div>
                            <button onClick={() => setShowDebtAssignModal(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-400" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4">
                             {confirmingOrder.items.map(item => (
                                 <div key={item.productId} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                     <img src={getProductImage(item.productId)} className="w-12 h-12 rounded bg-white object-cover border border-gray-200" alt="" />
                                     <div className="flex-1">
                                         <div className="flex justify-between mb-1">
                                             <span className="font-bold text-gray-800 dark:text-white text-sm">{item.productName}</span>
                                             <span className="text-xs font-bold text-gray-500">x{item.quantity}</span>
                                         </div>
                                         <div>
                                            <input 
                                                type="text" 
                                                list="debt-categories-orders"
                                                className="w-full text-xs p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Debt Category..."
                                                autoComplete="off"
                                                value={debtAssignments[item.productId] || ''}
                                                onChange={(e) => setDebtAssignments({
                                                    ...debtAssignments,
                                                    [item.productId]: e.target.value
                                                })}
                                            />
                                         </div>
                                     </div>
                                 </div>
                             ))}
                             <datalist id="debt-categories-orders">
                                {allDebtCategories.map(cat => <option key={cat} value={cat} />)}
                             </datalist>
                        </div>

                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
                            <div className="flex justify-between items-center mb-4 text-sm">
                                <span className="text-gray-500">Order Total</span>
                                <span className="text-xl font-bold text-blue-600">
                                    ₱{confirmingOrder.totalAmount.toLocaleString()}
                                </span>
                            </div>
                            <button 
                                onClick={handleConfirmDebtAssignment}
                                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 flex justify-center items-center"
                            >
                                Confirm & Add to Debt <ArrowRight size={18} className="ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Details Modal - Z-INDEX 60 */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        
                        {/* Header */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Order Details #{selectedOrder.id.replace('ord-', '')}</h3>
                            <button onClick={() => setSelectedOrder(null)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        
                        {/* Content */}
                        <div className="p-6 overflow-y-auto">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Customer</p>
                                    <p className="font-bold text-gray-900 dark:text-white text-lg">{selectedOrder.customerName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Date</p>
                                    <p className="font-medium text-gray-800 dark:text-gray-200">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-gray-700 mb-6">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-300">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Item</th>
                                            <th className="px-4 py-2 text-center">Qty</th>
                                            <th className="px-4 py-2 text-right">Price</th>
                                            <th className="px-4 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                                        {selectedOrder.items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                                                    <div>{item.productName}</div>
                                                    <div className="text-xs text-gray-500">{item.category}</div>
                                                </td>
                                                <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{item.quantity}</td>
                                                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">₱{item.price}</td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">₱{item.price * item.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 dark:bg-gray-700 font-bold text-gray-900 dark:text-white">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right">Grand Total</td>
                                            <td className="px-4 py-3 text-right">₱{selectedOrder.totalAmount.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>

                            <div className="flex justify-between items-center text-sm mb-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedOrder.status)}`}>
                                    Status: {selectedOrder.status}
                                </span>
                                <button 
                                    onClick={handlePrint}
                                    className="bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center shadow-sm"
                                >
                                    <Printer size={16} className="mr-2" />
                                    Print Receipt
                                </button>
                            </div>

                            {/* Admin Order Lifecycle Controls */}
                            {!isCustomer && selectedOrder.status !== OrderStatus.CANCELLED && selectedOrder.status !== OrderStatus.COMPLETED && (
                                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-4">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Update Status</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {selectedOrder.status === OrderStatus.PENDING && (
                                            <button 
                                                onClick={() => handleUpdateStatus(selectedOrder.id, OrderStatus.CONFIRMED)}
                                                className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm font-medium"
                                            >
                                                Confirm Order
                                            </button>
                                        )}
                                        {selectedOrder.status === OrderStatus.CONFIRMED && (
                                            <button 
                                                onClick={() => handleUpdateStatus(selectedOrder.id, OrderStatus.DELIVERING)}
                                                className="bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium flex justify-center items-center"
                                            >
                                                <Truck size={16} className="mr-2" /> Start Delivery
                                            </button>
                                        )}
                                        {selectedOrder.status === OrderStatus.DELIVERING && (
                                            <button 
                                                onClick={() => handleUpdateStatus(selectedOrder.id, OrderStatus.COMPLETED)}
                                                className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium flex justify-center items-center"
                                            >
                                                <CheckCircle size={16} className="mr-2" /> Mark Completed
                                            </button>
                                        )}
                                        
                                        <button 
                                            onClick={() => {
                                                if(confirm('Are you sure you want to cancel this order?')) {
                                                    handleUpdateStatus(selectedOrder.id, OrderStatus.CANCELLED);
                                                }
                                            }}
                                            className="bg-red-50 text-red-600 border border-red-200 px-3 py-2 rounded-lg hover:bg-red-100 text-sm font-medium"
                                        >
                                            Cancel Order
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* THERMAL PRINTER RECEIPT LAYOUT (Visible only on print) */}
                        <div id="printable-receipt" className="hidden printable-content">
                            <div className="print-center">
                                <h2 className="print-bold" style={{ fontSize: '16px', margin: '5px 0' }}>LEDGER CONNECT</h2>
                                <div style={{ fontSize: '10px' }}>Store Address, City, PH</div>
                                <div style={{ fontSize: '10px', marginBottom: '5px' }}>Tel: +63 900 000 0000</div>
                            </div>
                            
                            <div className="print-dashed"></div>
                            
                            <div className="print-row">
                                <span>Date:</span>
                                <span>{new Date(selectedOrder.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="print-row">
                                <span>Time:</span>
                                <span>{new Date(selectedOrder.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            </div>
                            <div className="print-row">
                                <span>Order #:</span>
                                <span>{selectedOrder.id.replace('ord-', '')}</span>
                            </div>
                            <div className="print-row">
                                <span>Cust:</span>
                                <span>{selectedOrder.customerName}</span>
                            </div>

                            <div className="print-dashed"></div>

                            {/* Items Header */}
                            <div style={{ display: 'flex', fontWeight: 'bold', marginBottom: '2px' }}>
                                <span style={{ width: '10%' }}>Q</span>
                                <span style={{ width: '50%' }}>Item</span>
                                <span style={{ width: '20%', textAlign: 'right' }}>@</span>
                                <span style={{ width: '20%', textAlign: 'right' }}>Amt</span>
                            </div>

                            {/* Items List */}
                            {selectedOrder.items.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', marginBottom: '2px' }}>
                                    <span style={{ width: '10%' }}>{item.quantity}</span>
                                    <span style={{ width: '50%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{item.productName}</span>
                                    <span style={{ width: '20%', textAlign: 'right' }}>{item.price}</span>
                                    <span style={{ width: '20%', textAlign: 'right' }}>{item.price * item.quantity}</span>
                                </div>
                            ))}

                            <div className="print-dashed"></div>

                            <div className="print-row print-bold" style={{ fontSize: '14px' }}>
                                <span>TOTAL</span>
                                <span>P {selectedOrder.totalAmount.toLocaleString()}</span>
                            </div>
                            
                            <div className="print-row" style={{ marginTop: '5px' }}>
                                <span>Status:</span>
                                <span style={{ textTransform: 'uppercase' }}>{selectedOrder.status}</span>
                            </div>

                            <div className="print-center" style={{ marginTop: '15px' }}>
                                <div>Thank you!</div>
                                <div style={{ fontSize: '10px', marginTop: '5px' }}>Powered by Ledger Connect</div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};
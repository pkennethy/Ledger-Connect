import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Search, Plus, Package, ShoppingCart, Minus, X, Trash2, Edit, LayoutGrid, LayoutList, AlertTriangle, Check, ArrowRight, ChevronLeft, ChevronRight, PackagePlus } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, User, UserRole, OrderStatus, Product } from '../types';
import { useToast } from '../context/ToastContext';

interface PageProps {
    lang: Language;
    user: User;
}

export const Products: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;
    const { showToast } = useToast();
    
    // Admin Modes: 'inventory' or 'pos'
    const [adminMode, setAdminMode] = useState<'inventory' | 'pos'>('inventory');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Default to Grid

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [showLowStockOnly, setShowLowStockOnly] = useState(false);
    const [refresh, setRefresh] = useState(0); // Trigger for re-calculating categories
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12; // 12 divides well by 2, 3, 4 for grid layouts

    const [products, setProducts] = useState(MockService.getProducts());
    
    // Admin: Add/Edit Product Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [newProduct, setNewProduct] = useState<Partial<Product>>({ category: 'General' });

    // Admin: Quick Restock Modal State (NEW)
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [restockTarget, setRestockTarget] = useState<Product | null>(null);
    const [restockQty, setRestockQty] = useState('');

    // Cart State
    const [cart, setCart] = useState<{product: Product, qty: number}[]>([]);
    const [showCart, setShowCart] = useState(false);
    
    // POS State
    const [posCustomer, setPosCustomer] = useState('');
    const [posPaymentType, setPosPaymentType] = useState<'cash' | 'credit'>('credit');

    // Debt Assignment Modal State (NEW)
    const [showDebtAssignModal, setShowDebtAssignModal] = useState(false);
    const [debtAssignments, setDebtAssignments] = useState<Record<string, string>>({}); // ProductID -> Category

    // Extract unique categories
    const categories = useMemo(() => {
        const unique = new Set(products.map(p => p.category));
        return ['All', ...Array.from(unique)];
    }, [products]);

    // All possible debt categories for suggestions (Products + Existing Debts)
    // Added refresh dependency to ensure new categories from debts appear immediately
    const allDebtCategories = useMemo(() => {
        const cats = new Set<string>();
        MockService.getDebts().forEach(d => cats.add(d.category));
        products.forEach(p => cats.add(p.category));
        return Array.from(cats).sort();
    }, [products, refresh]);

    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  p.category.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
            const matchesStock = showLowStockOnly ? p.stock < 20 : true;
            return matchesSearch && matchesCategory && matchesStock;
        });
    }, [products, searchTerm, selectedCategory, showLowStockOnly]);

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedCategory, showLowStockOnly]);

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // --- Actions ---

    const handleOpenAdd = () => {
        setEditingProduct(null);
        setNewProduct({ category: 'General', stock: 0, cost: 0, price: 0 });
        setShowAddModal(true);
    };

    const handleOpenEdit = (product: Product, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingProduct(product);
        setNewProduct({ ...product });
        setShowAddModal(true);
    };

    const handleDeleteProduct = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if(confirm('Delete this product permanently?')) {
            MockService.deleteProduct(id);
            setProducts([...MockService.getProducts()]);
            showToast('Product deleted', 'error');
        }
    };

    const handleSaveProduct = () => {
        if (!newProduct.name || !newProduct.price) {
            showToast('Name and Price are required', 'error');
            return;
        }
        
        const payload = {
            name: newProduct.name,
            category: newProduct.category || 'General',
            price: Number(newProduct.price),
            cost: Number(newProduct.cost || 0),
            stock: Number(newProduct.stock || 0),
            imageUrl: newProduct.imageUrl || `https://picsum.photos/300/300?random=${Date.now()}`
        };

        if (editingProduct) {
            MockService.updateProduct(editingProduct.id, payload);
            showToast('Product updated', 'success');
        } else {
            MockService.addProduct({
                id: `p-${Date.now()}`,
                ...payload
            } as Product);
            showToast('Product created', 'success');
        }
        
        setProducts([...MockService.getProducts()]);
        setShowAddModal(false);
        setNewProduct({ category: 'General' });
        setEditingProduct(null);
        setRefresh(prev => prev + 1);
    };

    // --- QUICK RESTOCK ACTIONS ---
    const handleOpenRestock = (product: Product, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setRestockTarget(product);
        setRestockQty('');
        setShowRestockModal(true);
    };

    const handleSubmitRestock = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!restockTarget || !restockQty) return;

        const qtyToAdd = parseInt(restockQty);
        if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
            showToast('Please enter a valid quantity greater than 0', 'error');
            return;
        }

        const newStock = restockTarget.stock + qtyToAdd;
        MockService.updateProduct(restockTarget.id, { stock: newStock });
        
        showToast(`Stock added! New total: ${newStock}`, 'success');
        setProducts([...MockService.getProducts()]);
        setShowRestockModal(false);
        setRestockTarget(null);
        setRestockQty('');
    };

    // --- CART ACTIONS ---
    const addToCart = (product: Product, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const existing = cart.find(i => i.product.id === product.id);
        if (existing) {
            setCart(cart.map(i => i.product.id === product.id ? {...i, qty: i.qty + 1} : i));
        } else {
            setCart([...cart, { product, qty: 1 }]);
        }
        
        if (isAdmin && adminMode === 'pos') {
            setShowCart(true);
        } else {
            showToast(`Added ${product.name}`, 'info');
        }
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(i => i.product.id !== productId));
    };

    const updateQty = (productId: string, delta: number) => {
        setCart(cart.map(i => {
            if (i.product.id === productId) {
                const newQty = Math.max(1, i.qty + delta);
                return {...i, qty: newQty};
            }
            return i;
        }));
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;

        if (isAdmin && adminMode === 'pos') {
            if (!posCustomer) {
                showToast("Select a customer first", 'error');
                return;
            }
            
            // NEW: Intercept Credit Transactions for Category Assignment
            if (posPaymentType === 'credit') {
                const initialAssignments: Record<string, string> = {};
                // Pre-pick defaults: Last used category OR Product category
                cart.forEach(item => {
                    const lastCat = MockService.getLastUsedCategory(posCustomer, item.product.id);
                    initialAssignments[item.product.id] = lastCat || item.product.category;
                });
                setDebtAssignments(initialAssignments);
                setShowDebtAssignModal(true);
                return;
            }

            // Cash Transaction (No assignment needed)
            MockService.processPOSTransaction(posCustomer, cart, true);
            showToast('Cash Sale Recorded', 'success');
            setCart([]);
            setShowCart(false);
            setPosCustomer('');
            setProducts([...MockService.getProducts()]);
            setRefresh(prev => prev + 1);
        } else {
            // Customer Checkout (Self-Ordering)
            const total = cart.reduce((s, i) => s + (i.product.price * i.qty), 0);
            MockService.createOrder({
                id: `ord-${Date.now()}`,
                customerId: user.id,
                customerName: user.name,
                items: cart.map(i => ({
                    productId: i.product.id,
                    productName: i.product.name,
                    quantity: i.qty,
                    price: i.product.price,
                    category: i.product.category
                })),
                totalAmount: total,
                status: OrderStatus.PENDING,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            showToast("Order sent for confirmation", 'success');
            setCart([]);
            setShowCart(false);
        }
    };

    const handleConfirmDebtAssignment = () => {
        // Submit Credit Transaction with Assignments
        MockService.processPOSTransaction(posCustomer, cart, false, debtAssignments);
        showToast('Charged to Account with assigned categories', 'success');
        setCart([]);
        setShowCart(false);
        setPosCustomer('');
        setShowDebtAssignModal(false);
        setProducts([...MockService.getProducts()]);
        setRefresh(prev => prev + 1);
    };

    const getProfit = (p: Product) => p.price - p.cost;

    return (
        <div className="space-y-2 pb-20">
            {/* STICKY HEADER WRAPPER: Contains Search and Filters */}
            <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md -mx-4 px-4 pt-1 pb-2 shadow-sm transition-all">
                {/* Header Controls */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            {isAdmin ? t.products : t.shop}
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{filteredProducts.length} items</span>
                        </h2>
                        {isAdmin && (
                            <div className="flex gap-2 text-xs">
                                 <button onClick={() => setAdminMode('inventory')} className={`hover:underline ${adminMode === 'inventory' ? 'text-orange-600 font-bold' : 'text-gray-500'}`}>Inventory</button>
                                 <span className="text-gray-300">|</span>
                                 <button onClick={() => setAdminMode('pos')} className={`hover:underline ${adminMode === 'pos' ? 'text-orange-600 font-bold' : 'text-gray-500'}`}>POS Terminal</button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                         {/* Search */}
                        <div className="relative flex-1 xl:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search in store..." 
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-orange-500 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* View Toggle */}
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow text-orange-600' : 'text-gray-400'}`}><LayoutList size={18} /></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow text-orange-600' : 'text-gray-400'}`}><LayoutGrid size={18} /></button>
                        </div>

                        {/* Actions */}
                        {isAdmin && adminMode === 'inventory' && (
                            <>
                                 <button 
                                    onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                                    className={`p-2 rounded-lg border transition-colors ${showLowStockOnly ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-gray-200 text-gray-500'}`}
                                    title="Toggle Low Stock"
                                >
                                    <AlertTriangle size={18} />
                                </button>
                                {/* Removed CSV Import Here */}
                                <button onClick={handleOpenAdd} className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-orange-700 shadow-sm"><Plus size={16} className="mr-1" /> Add</button>
                            </>
                        )}
                        {(!isAdmin || adminMode === 'pos') && (
                            <button onClick={() => setShowCart(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center shadow-sm relative hover:bg-orange-700">
                                <ShoppingCart size={18} className="mr-2" />
                                {cart.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">{cart.reduce((a,c) => a + c.qty, 0)}</span>}
                            </button>
                        )}
                    </div>
                </div>

                {/* Category Filter - Sticky inside Header */}
                <div className="flex gap-2 overflow-x-auto pb-1 mt-2 scrollbar-hide">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                selectedCategory === cat 
                                ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm' 
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            {paginatedProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 min-h-[300px]">
                    <Package size={48} className="mb-2 opacity-50" />
                    <p>No products found</p>
                </div>
            ) : viewMode === 'list' ? (
                // --- TABLE VIEW (Dense for Inventory) ---
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Product</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Category</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Price</th>
                                    {isAdmin && adminMode === 'inventory' && (
                                        <>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center whitespace-nowrap">Stock</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right hidden lg:table-cell whitespace-nowrap">Margin</th>
                                            <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                                        </>
                                    )}
                                    {(!isAdmin || adminMode === 'pos') && (
                                        <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Add</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paginatedProducts.map(product => (
                                    <tr 
                                        key={product.id} 
                                        onClick={(!isAdmin || adminMode === 'pos') ? (e) => addToCart(product, e) : undefined}
                                        className={`hover:bg-orange-50/30 dark:hover:bg-gray-700/50 transition-colors ${(!isAdmin || adminMode === 'pos') ? 'cursor-pointer' : ''}`}
                                    >
                                        <td className="px-4 py-2">
                                            <div className="flex items-center">
                                                <img src={product.imageUrl} className="w-8 h-8 rounded object-cover bg-gray-100 border border-gray-100 mr-3" alt="" />
                                                <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate max-w-[150px]">{product.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                {product.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <span className="font-bold text-orange-600 dark:text-orange-400 text-sm">₱{product.price}</span>
                                        </td>
                                        
                                        {isAdmin && adminMode === 'inventory' && (
                                            <>
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                            product.stock < 20 ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-600 bg-green-50 border-green-200'
                                                        }`}>
                                                            {product.stock}
                                                        </span>
                                                        <button 
                                                            onClick={(e) => handleOpenRestock(product, e)}
                                                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                                            title="Quick Restock"
                                                        >
                                                            <PackagePlus size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-right hidden lg:table-cell">
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] text-green-600 font-bold">+₱{getProfit(product)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={(e) => handleOpenEdit(product, e)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit size={14} /></button>
                                                        <button onClick={(e) => handleDeleteProduct(product.id, e)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                        {(!isAdmin || adminMode === 'pos') && (
                                             <td className="px-4 py-2 text-right">
                                                <button onClick={(e) => addToCart(product, e)} className="p-1.5 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition-colors">
                                                    <Plus size={14} />
                                                </button>
                                             </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                // --- GRID VIEW (Compact & Immersive) ---
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
                    {paginatedProducts.map(product => (
                        <div 
                            key={product.id} 
                            onClick={(!isAdmin || adminMode === 'pos') ? (e) => addToCart(product, e) : undefined}
                            className={`relative aspect-square bg-gray-200 rounded-xl overflow-hidden group shadow-sm ${(!isAdmin || adminMode === 'pos') ? 'cursor-pointer' : ''}`}
                        >
                            {/* Image covering full area */}
                            <img 
                                src={product.imageUrl} 
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                                alt={product.name} 
                            />
                            
                            {/* Gradient Overlay for Text Readability */}
                            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                            {/* Top Right Actions (Admin) */}
                            {isAdmin && adminMode === 'inventory' && (
                                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={(e) => handleOpenRestock(product, e)} className="bg-white/90 p-1.5 rounded-full text-green-600 shadow-sm backdrop-blur-sm hover:scale-110 transition-transform" title="Quick Restock"><PackagePlus size={14} /></button>
                                    <button onClick={(e) => handleOpenEdit(product, e)} className="bg-white/90 p-1.5 rounded-full text-blue-600 shadow-sm backdrop-blur-sm hover:scale-110 transition-transform"><Edit size={14} /></button>
                                    <button onClick={(e) => handleDeleteProduct(product.id, e)} className="bg-white/90 p-1.5 rounded-full text-red-600 shadow-sm backdrop-blur-sm hover:scale-110 transition-transform"><Trash2 size={14} /></button>
                                </div>
                            )}

                            {/* Low Stock Badge */}
                            {product.stock < 20 && (
                                <div className="absolute top-2 left-2 bg-red-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm z-10 uppercase tracking-wider">
                                    {product.stock === 0 ? 'Sold Out' : `${product.stock} Left`}
                                </div>
                            )}

                            {/* Content Overlay */}
                            <div className="absolute bottom-0 left-0 w-full p-3 flex items-end justify-between gap-2 z-10">
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-bold text-lg leading-none mb-1 drop-shadow-md">₱{product.price.toLocaleString()}</div>
                                    <h3 className="text-white/90 text-xs font-medium leading-tight line-clamp-2 drop-shadow-md">
                                        {product.name}
                                    </h3>
                                </div>
                                
                                {(!isAdmin || adminMode === 'pos') && (
                                    <button 
                                        onClick={(e) => addToCart(product, e)}
                                        className="bg-white/20 hover:bg-white/30 text-white border border-white/40 p-2 rounded-full backdrop-blur-md shadow-lg transition-all active:scale-95 shrink-0"
                                    >
                                        <Plus size={18} strokeWidth={3} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {filteredProducts.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredProducts.length)}</span> of <span className="font-bold">{filteredProducts.length}</span> items
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

            {/* Quick Restock Modal (Small, Fast) */}
            {showRestockModal && restockTarget && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 dark:text-white">Quick Restock</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{restockTarget.name}</p>
                            </div>
                            <button onClick={() => setShowRestockModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"><X size={20} className="text-gray-400" /></button>
                        </div>
                        
                        <form onSubmit={handleSubmitRestock}>
                            <div className="mb-4">
                                <div className="flex justify-between text-sm mb-2 font-medium">
                                    <span className="text-gray-600 dark:text-gray-300">Current Stock:</span>
                                    <span className="text-gray-900 dark:text-white">{restockTarget.stock}</span>
                                </div>
                                <div className="relative">
                                    <PackagePlus size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="number" 
                                        autoFocus
                                        placeholder="Qty to add" 
                                        className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-lg font-bold"
                                        value={restockQty}
                                        onChange={(e) => setRestockQty(e.target.value)}
                                    />
                                </div>
                                {restockQty && !isNaN(parseInt(restockQty)) && (
                                    <div className="mt-2 text-right text-sm">
                                        <span className="text-gray-500">New Total: </span>
                                        <span className="font-bold text-green-600">{restockTarget.stock + parseInt(restockQty)}</span>
                                    </div>
                                )}
                            </div>
                            <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 shadow-lg shadow-green-500/30">
                                Confirm Restock
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Admin Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                                {editingProduct ? 'Edit Product' : 'Add Product'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-400" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Product Name</label>
                                <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. Premium Rice" value={newProduct.name || ''} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Price (SRP)</label>
                                    <input type="number" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0.00" value={newProduct.price || ''} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Cost (Capital)</label>
                                    <input type="number" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0.00" value={newProduct.cost || ''} onChange={e => setNewProduct({...newProduct, cost: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Stock</label>
                                    <input type="number" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0" value={newProduct.stock || ''} onChange={e => setNewProduct({...newProduct, stock: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                                    <input 
                                        list="debt-categories" 
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" 
                                        placeholder="General" 
                                        autoComplete="off"
                                        value={newProduct.category || ''} 
                                        onChange={e => setNewProduct({...newProduct, category: e.target.value})} 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Image URL</label>
                                <input className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" placeholder="https://..." value={newProduct.imageUrl || ''} onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})} />
                            </div>
                            <button onClick={handleSaveProduct} className="w-full bg-orange-600 text-white py-3.5 rounded-xl font-bold hover:bg-orange-700 shadow-lg shadow-orange-500/30 mt-2">
                                {editingProduct ? 'Save Changes' : 'Create Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Debt Category Assignment Modal (NEW) */}
            {showDebtAssignModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                         <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4 shrink-0">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">Assign Debt Categories</h3>
                                <p className="text-xs text-gray-500">Group items by debt type before confirming.</p>
                            </div>
                            <button onClick={() => setShowDebtAssignModal(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-400" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 mb-4">
                             {cart.map(item => (
                                 <div key={item.product.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                     <img src={item.product.imageUrl} className="w-12 h-12 rounded bg-white object-cover border border-gray-200" alt="" />
                                     <div className="flex-1">
                                         <div className="flex justify-between mb-1">
                                             <span className="font-bold text-gray-800 dark:text-white text-sm">{item.product.name}</span>
                                             <span className="text-xs font-bold text-gray-500">x{item.qty}</span>
                                         </div>
                                         <div>
                                            <input 
                                                type="text" 
                                                list="debt-categories"
                                                className="w-full text-xs p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Debt Category..."
                                                autoComplete="off"
                                                // Key Fix: Use || '' to ensure fully controlled component without fallback to props during render.
                                                // State is already initialized in handleCheckout with defaults.
                                                value={debtAssignments[item.product.id] || ''}
                                                onChange={(e) => setDebtAssignments({
                                                    ...debtAssignments,
                                                    [item.product.id]: e.target.value
                                                })}
                                            />
                                         </div>
                                     </div>
                                 </div>
                             ))}
                        </div>

                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
                            <div className="flex justify-between items-center mb-4 text-sm">
                                <span className="text-gray-500">Total Amount</span>
                                <span className="text-xl font-bold text-red-600">
                                    ₱{cart.reduce((s, i) => s + (i.product.price * i.qty), 0).toLocaleString()}
                                </span>
                            </div>
                            <button 
                                onClick={handleConfirmDebtAssignment}
                                className="w-full bg-red-600 text-white py-3.5 rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-500/30 flex justify-center items-center"
                            >
                                Confirm Transaction <ArrowRight size={18} className="ml-2" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Global Datalist for Categories */}
            <datalist id="debt-categories">
                {allDebtCategories.map(cat => <option key={cat} value={cat} />)}
            </datalist>

            {/* Cart Sidebar */}
            {showCart && !showDebtAssignModal && (
                <div className="fixed inset-0 bg-black/40 z-[80] flex justify-end">
                    <div className="bg-white dark:bg-gray-900 w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <ShoppingCart size={22} className="text-orange-600" />
                                {isAdmin && adminMode === 'pos' ? 'POS Terminal' : 'Your Cart'}
                            </h3>
                            <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {cart.length === 0 ? (
                                <div className="text-center text-gray-400 mt-20 flex flex-col items-center">
                                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><Package size={32} /></div>
                                    <p className="font-medium">Cart is empty</p>
                                    <p className="text-sm">Start adding items!</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.product.id} className="flex gap-4 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <img src={item.product.imageUrl} className="w-20 h-20 object-cover rounded-lg bg-gray-100" alt="" />
                                        <div className="flex-1 flex flex-col justify-between">
                                            <div>
                                                <h4 className="font-bold text-gray-800 dark:text-gray-100 line-clamp-1">{item.product.name}</h4>
                                                <p className="text-orange-600 font-bold">₱{item.product.price * item.qty}</p>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                                    <button onClick={() => updateQty(item.product.id, -1)} className="p-1 hover:bg-white rounded"><Minus size={14} /></button>
                                                    <span className="text-sm font-bold w-8 text-center">{item.qty}</span>
                                                    <button onClick={() => updateQty(item.product.id, 1)} className="p-1 hover:bg-white rounded"><Plus size={14} /></button>
                                                </div>
                                                <button onClick={() => removeFromCart(item.product.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 space-y-4">
                                {isAdmin && adminMode === 'pos' && (
                                    <div className="bg-white p-3 rounded-xl border border-gray-200 space-y-3">
                                        <select className="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500" value={posCustomer} onChange={e => setPosCustomer(e.target.value)}>
                                            <option value="">Select Customer</option>
                                            {MockService.getCustomers().map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <div className="flex gap-2">
                                            <button onClick={() => setPosPaymentType('credit')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${posPaymentType === 'credit' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-500'}`}>Credit (Debt)</button>
                                            <button onClick={() => setPosPaymentType('cash')} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide border transition-all ${posPaymentType === 'cash' ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-gray-200 text-gray-500'}`}>Cash</button>
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-end">
                                    <span className="text-gray-500 font-medium">Total Amount</span>
                                    <span className="text-2xl font-black text-gray-900 dark:text-white">₱{cart.reduce((s, i) => s + (i.product.price * i.qty), 0).toLocaleString()}</span>
                                </div>
                                <button onClick={handleCheckout} className={`w-full text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:translate-y-[-2px] transition-all ${isAdmin && adminMode === 'pos' && posPaymentType === 'credit' ? 'bg-red-600 shadow-red-500/30' : 'bg-orange-600 shadow-orange-500/30'}`}>
                                    {isAdmin && adminMode === 'pos' ? (posPaymentType === 'cash' ? 'Complete Cash Sale' : 'Charge to Account') : 'Checkout Now'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
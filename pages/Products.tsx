
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Search, Plus, Package, ShoppingCart, Minus, X, Trash2, Edit, LayoutGrid, LayoutList, AlertTriangle, Check, ArrowRight, ChevronLeft, ChevronRight, PackagePlus } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, Product, User, UserRole } from '../types';
import { useToast } from '../context/ToastContext';

// Define local PageProps for consistency across page components
interface PageProps {
    lang: Language;
    user: User;
}

export const Products: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    // Fix: Defined isAdmin based on user role
    const isAdmin = user.role === UserRole.ADMIN;
    const { showToast } = useToast();

    // State for UI management
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    // Fix: Defined adminMode for toggling between POS and Inventory views
    const [adminMode, setAdminMode] = useState<'inventory' | 'pos'>('inventory');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // Form state for creating/editing products
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        price: '',
        cost: '',
        stock: '',
        imageUrl: '',
        description: ''
    });

    // Memoized product list filtering
    const filteredProducts = useMemo(() => {
        const list = MockService.getProducts();
        return list.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    // Pagination logic
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Fix: Defined handleOpenAdd to reset form and show modal
    const handleOpenAdd = () => {
        setEditingProduct(null);
        setFormData({ name: '', category: '', price: '', cost: '', stock: '', imageUrl: '', description: '' });
        setIsModalOpen(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            category: product.category,
            price: product.price.toString(),
            cost: product.cost.toString(),
            stock: product.stock.toString(),
            imageUrl: product.imageUrl,
            description: product.description || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Delete this product permanently?')) {
            await MockService.deleteProduct(id);
            showToast('Product deleted from database', 'success');
            // Force re-render
            setSearchTerm(prev => prev);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const data = {
            ...formData,
            price: parseFloat(formData.price) || 0,
            cost: parseFloat(formData.cost) || 0,
            stock: parseInt(formData.stock) || 0,
            imageUrl: formData.imageUrl || `https://picsum.photos/400/400?random=${Math.random()}`
        };

        try {
            if (editingProduct) {
                await MockService.updateProduct(editingProduct.id, data);
                showToast('Stock updated successfully', 'success');
            } else {
                await MockService.addProduct({
                    id: `p-${Date.now()}`,
                    ...data
                });
                showToast('Product registered in catalog', 'success');
            }
            setIsModalOpen(false);
        } catch (error) {
            showToast('Failed to save product details', 'error');
        }
    };

    return (
        <div className="space-y-6 relative min-h-full pb-24">
            {/* Header with Search and Mode Toggle */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md z-30 -mx-4 px-4 py-2 border-b dark:border-gray-800">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t.products}</h2>
                    {isAdmin && (
                        <div className="flex bg-gray-200/50 dark:bg-gray-800 p-1 rounded-xl shadow-inner border dark:border-gray-700">
                            <button onClick={() => setAdminMode('inventory')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${adminMode === 'inventory' ? 'bg-white dark:bg-gray-700 shadow-md text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>Inventory</button>
                            <button onClick={() => setAdminMode('pos')} className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${adminMode === 'pos' ? 'bg-white dark:bg-gray-700 shadow-md text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>POS Sales</button>
                        </div>
                    )}
                </div>
                <div className="flex gap-2 w-full md:w-auto items-center">
                    <div className="relative flex-1 md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search catalog..." 
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-gray-200/50 dark:bg-gray-800 p-1 rounded-xl shadow-inner">
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-700 shadow text-orange-600' : 'text-gray-400'}`}><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow text-orange-600' : 'text-gray-400'}`}><LayoutList size={18} /></button>
                    </div>
                </div>
            </div>

            {/* Content: Grid or Table View */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-5">
                    {paginatedProducts.map(product => (
                        <div key={product.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col group hover:shadow-xl hover:-translate-y-1 transition-all">
                            <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-900">
                                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                {product.stock <= 5 && (
                                    <div className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                                        <AlertTriangle size={10} /> LOW STOCK
                                    </div>
                                )}
                                <div className="absolute bottom-2 right-2 px-2 py-1 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-tighter shadow-sm border dark:border-gray-700">
                                    {product.category}
                                </div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                                <h4 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2 leading-tight mb-2 h-10">{product.name}</h4>
                                <div className="mt-auto pt-2 flex justify-between items-end border-t dark:border-gray-700">
                                    <div>
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Retail</p>
                                        <p className="font-black text-orange-600 text-lg">₱{product.price.toLocaleString()}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Stock</p>
                                        <p className={`text-sm font-black font-mono ${product.stock <= 5 ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'}`}>{product.stock}</p>
                                    </div>
                                </div>
                            </div>
                            {isAdmin && adminMode === 'inventory' && (
                                <div className="p-2 bg-gray-50 dark:bg-gray-900/50 flex gap-2 border-t dark:border-gray-700">
                                    <button onClick={() => handleEdit(product)} className="flex-1 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-widest border dark:border-gray-700 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-100 transition-all">Edit</button>
                                    <button onClick={() => handleDelete(product.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-xl transition-colors"><Trash2 size={16} /></button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b dark:border-gray-700">
                            <tr>
                                <th className="p-4">Item Catalog</th>
                                <th className="p-4">Category</th>
                                <th className="p-4 text-right">Price</th>
                                {isAdmin && adminMode === 'inventory' && <th className="p-4 text-right">Cost</th>}
                                <th className="p-4 text-center">In Stock</th>
                                {isAdmin && adminMode === 'inventory' && <th className="p-4 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginatedProducts.map(product => (
                                <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-4">
                                            <img src={product.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover border dark:border-gray-700 shadow-sm" />
                                            <div>
                                                <span className="font-bold text-gray-800 dark:text-gray-200 block">{product.name}</span>
                                                <span className="text-[10px] text-gray-400">ID: {product.id}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4"><span className="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">{product.category}</span></td>
                                    <td className="p-4 text-right font-black text-orange-600 font-mono">₱{product.price.toLocaleString()}</td>
                                    {isAdmin && adminMode === 'inventory' && <td className="p-4 text-right text-sm text-gray-400 font-mono">₱{product.cost.toLocaleString()}</td>}
                                    <td className="p-4 text-center">
                                        <span className={`text-sm font-black font-mono px-3 py-1 rounded-full ${product.stock <= 5 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600 dark:bg-green-900/20'}`}>
                                            {product.stock}
                                        </span>
                                    </td>
                                    {isAdmin && adminMode === 'inventory' && (
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEdit(product)} className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"><Edit size={18} /></button>
                                                <button onClick={() => handleDelete(product.id)} className="p-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /></button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-colors"><ChevronLeft size={18} /></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-colors"><ChevronRight size={18} /></button>
                    </div>
                </div>
            )}

            {/* Floating Action Button */}
            {isAdmin && adminMode === 'inventory' && (
                <button 
                    onClick={handleOpenAdd}
                    className="fixed bottom-[140px] right-6 md:bottom-28 md:right-10 w-16 h-16 bg-orange-600 text-white rounded-full shadow-[0_8px_30px_rgb(234,88,12,0.4)] flex items-center justify-center hover:bg-orange-700 hover:scale-110 active:scale-95 transition-all z-40 animate-in zoom-in duration-300"
                    title="Add Product"
                >
                    <Plus size={36} strokeWidth={3} />
                </button>
            )}

            {/* Modal for Add/Edit Product */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">{editingProduct ? 'Edit Catalog Entry' : 'New Catalog Item'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Product Name</label>
                                    <input required type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-xl outline-none transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Premium Rice 25kg" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Category</label>
                                    <input required type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-xl outline-none transition-all" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g. Grains, Beverages" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Retail Price (₱)</label>
                                    <input required type="number" step="0.01" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-xl outline-none transition-all font-mono" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Capital Cost (₱)</label>
                                    <input required type="number" step="0.01" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-xl outline-none transition-all font-mono" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Stock Count</label>
                                    <input required type="number" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-xl outline-none transition-all font-mono" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Image URL</label>
                                    <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-orange-500 rounded-xl outline-none transition-all text-xs" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-orange-700 shadow-lg shadow-orange-500/20 active:scale-95 transition-all mt-4">
                                {editingProduct ? 'Save Stock Adjustments' : 'Commit New Product'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

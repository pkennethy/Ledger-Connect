
import React, { useState, useMemo } from 'react';
import { Search, Plus, Package, ShoppingCart, Minus, X, Trash2, Edit, LayoutGrid, LayoutList, AlertTriangle, Check, ArrowRight, ChevronLeft, ChevronRight, PackagePlus, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, Product, User, UserRole } from '../types';
import { useToast } from '../context/ToastContext';

interface PageProps {
    lang: Language;
    user: User;
}

export const Products: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;
    const { showToast } = useToast();

    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [adminMode, setAdminMode] = useState<'inventory' | 'pos'>('inventory');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    const [formData, setFormData] = useState({
        name: '',
        category: '',
        price: '',
        cost: '',
        stock: '',
        imageUrl: '',
        description: ''
    });

    const filteredProducts = useMemo(() => {
        const list = MockService.getProducts();
        return list.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            p.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, isModalOpen]);

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
            setSearchTerm(prev => prev);
        }
    };

    const generateRandomImage = () => {
        const keywords = ['grocery', 'food', 'product', 'drink', 'snack', 'household'];
        const randomKey = keywords[Math.floor(Math.random() * keywords.length)];
        const url = `https://loremflickr.com/400/400/${randomKey}?lock=${Math.floor(Math.random() * 1000)}`;
        setFormData({ ...formData, imageUrl: url });
        showToast("Random image generated", "info");
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

            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-colors"><ChevronLeft size={18} /></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded-xl disabled:opacity-30 hover:bg-gray-50 transition-colors"><ChevronRight size={18} /></button>
                    </div>
                </div>
            )}

            {isAdmin && adminMode === 'inventory' && (
                <button 
                    onClick={handleOpenAdd}
                    className="fixed bottom-[140px] right-6 md:bottom-28 md:right-10 w-16 h-16 bg-orange-600 text-white rounded-full shadow-[0_8px_30px_rgb(234,88,12,0.4)] flex items-center justify-center hover:bg-orange-700 hover:scale-110 active:scale-95 transition-all z-40 animate-in zoom-in duration-300"
                    title="Add Product"
                >
                    <Plus size={36} strokeWidth={3} />
                </button>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="bg-orange-600 p-6 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <PackagePlus size={20} strokeWidth={3} />
                                <h3 className="font-black uppercase tracking-tight text-sm">{editingProduct ? 'Edit Catalog Entry' : 'New Catalog Item'}</h3>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                {/* IMAGE PREVIEW SECTION */}
                                <div className="md:col-span-5 space-y-4">
                                    <div className="relative aspect-square rounded-3xl bg-gray-100 dark:bg-slate-950 border-4 border-dashed border-gray-200 dark:border-slate-800 overflow-hidden flex flex-col items-center justify-center group">
                                        {formData.imageUrl ? (
                                            <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.src = "https://via.placeholder.com/400?text=Invalid+Image+URL")} />
                                        ) : (
                                            <div className="text-center p-6">
                                                <ImageIcon size={48} className="mx-auto text-gray-300 mb-2" />
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Image Provided</p>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <button type="button" onClick={generateRandomImage} className="bg-white text-orange-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                                                <RefreshCw size={14} /> Random Magic
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Asset URL (JPG/PNG)</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all text-[11px] dark:text-white font-mono" 
                                                value={formData.imageUrl} 
                                                onChange={e => setFormData({...formData, imageUrl: e.target.value})} 
                                                placeholder="https://example.com/image.jpg" 
                                            />
                                            {formData.imageUrl && (
                                                <button type="button" onClick={() => setFormData({...formData, imageUrl: ''})} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"><X size={16} /></button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* DETAILS SECTION */}
                                <div className="md:col-span-7 space-y-5">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Product Designation</label>
                                            <input required type="text" className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all dark:text-white font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Premium Rice 25kg" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Ledger Category</label>
                                            <input required type="text" className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all dark:text-white font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g. Grains, Beverages" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Sale Price (₱)</label>
                                            <input required type="number" step="0.01" className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all font-black text-orange-600 text-xl font-mono" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Capital Cost (₱)</label>
                                            <input required type="number" step="0.01" className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all font-bold text-gray-400 font-mono" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Current Stock Level</label>
                                            <div className="flex items-center gap-3">
                                                <input required type="number" className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-orange-500 rounded-2xl outline-none transition-all font-black text-xl dark:text-white font-mono" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
                                                <div className="flex flex-col gap-1 shrink-0">
                                                    <button type="button" onClick={() => setFormData({...formData, stock: (parseInt(formData.stock || '0') + 10).toString()})} className="px-3 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase text-gray-500">+10</button>
                                                    <button type="button" onClick={() => setFormData({...formData, stock: (parseInt(formData.stock || '0') + 50).toString()})} className="px-3 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-[9px] font-black uppercase text-gray-500">+50</button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-10 pt-8 border-t dark:border-slate-800 flex gap-4">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-3xl font-black uppercase tracking-widest text-[11px] hover:bg-gray-200 active:scale-95 transition-all">Cancel</button>
                                <button type="submit" className="flex-[2] bg-orange-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-orange-500/20 hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                                    <PackagePlus size={18} />
                                    {editingProduct ? 'Commit Adjustments' : 'Finalize Catalog Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

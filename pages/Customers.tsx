
import React, { useState, useMemo } from 'react';
import { Search, Plus, Phone, Edit, Trash2, User as UserIcon, X, LayoutGrid, LayoutList, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, User, UserRole, Customer } from '../types';
import { useToast } from '../context/ToastContext';

// Define local PageProps for consistency across page components
interface PageProps {
    lang: Language;
    user: User;
}

export const Customers: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    // Fix: Defined isAdmin based on user role
    const isAdmin = user.role === UserRole.ADMIN;
    const { showToast } = useToast();

    // State for search and view layout
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // Form state for creating/editing customers
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        email: ''
    });

    // Memoized live balances for consistency
    const customerBalances = useMemo(() => {
        const debts = MockService.getDebts();
        const payments = MockService.getRepayments();
        const balances: Record<string, number> = {};
        
        MockService.getCustomers().forEach(c => {
            const cDebts = debts.filter(d => d.customerId === c.id);
            const cPayments = payments.filter(p => p.customerId === c.id);
            balances[c.id] = Math.max(0, cDebts.reduce((s,d)=>s+d.amount,0) - cPayments.reduce((s,p)=>s+p.amount,0));
        });
        return balances;
    }, [searchTerm, isModalOpen]); // Refresh when list might change

    // Memoized customer list filtering
    const filteredCustomers = useMemo(() => {
        const list = MockService.getCustomers().filter(c => c.role !== UserRole.ADMIN);
        return list.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            c.phone.includes(searchTerm)
        );
    }, [searchTerm]);

    // Pagination logic
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const paginatedCustomers = filteredCustomers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Fix: Defined openAddModal to reset form and show modal
    const openAddModal = () => {
        setEditingCustomer(null);
        setFormData({ name: '', phone: '', address: '', email: '' });
        setIsModalOpen(true);
    };

    const handleEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setFormData({ 
            name: customer.name, 
            phone: customer.phone, 
            address: customer.address, 
            email: customer.email || '' 
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this customer?')) {
            await MockService.deleteCustomer(id);
            showToast('Customer deleted', 'success');
            setSearchTerm(prev => prev);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingCustomer) {
                await MockService.updateCustomer(editingCustomer.id, formData);
                showToast('Customer updated', 'success');
            } else {
                await MockService.addCustomer({
                    id: `c-${Date.now()}`,
                    ...formData,
                    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`,
                    totalDebt: 0,
                    role: UserRole.CUSTOMER
                });
                showToast('Customer added', 'success');
            }
            setIsModalOpen(false);
        } catch (error) {
            showToast('Operation failed', 'error');
        }
    };

    return (
        <div className="space-y-6 relative min-h-full">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t.customers}</h2>
                <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="Search customers..." 
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg shadow-inner">
                        <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}><LayoutGrid size={18} /></button>
                        <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}><LayoutList size={18} /></button>
                    </div>
                </div>
            </div>

            {/* Main Content: Grid or List View */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {paginatedCustomers.map(customer => {
                        const bal = customerBalances[customer.id] || 0;
                        return (
                            <div key={customer.id} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 hover:shadow-lg hover:-translate-y-1 transition-all">
                                <div className="flex items-center gap-4 mb-4">
                                    <img src={customer.avatarUrl} alt={customer.name} className="w-14 h-14 rounded-full border-2 border-gray-100 dark:border-gray-700 shadow-sm" />
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-gray-900 dark:text-white truncate text-lg">{customer.name}</h4>
                                        <p className="text-sm text-gray-500 flex items-center gap-1.5"><Phone size={14} className="text-blue-500" /> {customer.phone}</p>
                                    </div>
                                </div>
                                <div className="space-y-3 mb-6">
                                    <p className="text-xs text-gray-500 flex items-start gap-1.5"><MapPin size={14} className="text-gray-400 shrink-0" /> <span className="line-clamp-2">{customer.address}</span></p>
                                    <div className="flex justify-between items-center bg-blue-50/50 dark:bg-gray-900/50 px-4 py-3 rounded-xl border border-blue-50 dark:border-gray-700">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Due</span>
                                        <span className="font-black text-red-600 text-lg">₱{bal.toLocaleString()}</span>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="flex gap-2 pt-2">
                                        <button onClick={() => handleEdit(customer)} className="flex-1 py-2.5 text-sm font-black uppercase tracking-widest text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded-xl transition-colors flex items-center justify-center gap-2"><Edit size={16} /> Edit</button>
                                        <button onClick={() => handleDelete(customer.id)} className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-xl transition-colors"><Trash2 size={18} /></button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b dark:border-gray-700">
                            <tr>
                                <th className="p-4">Customer</th>
                                <th className="p-4">Phone</th>
                                <th className="p-4">Address</th>
                                <th className="p-4 text-right">Outstanding</th>
                                {isAdmin && <th className="p-4 text-right">Actions</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {paginatedCustomers.map(customer => {
                                const bal = customerBalances[customer.id] || 0;
                                return (
                                    <tr key={customer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img src={customer.avatarUrl} alt="" className="w-10 h-10 rounded-full border dark:border-gray-600" />
                                                <span className="font-bold text-gray-800 dark:text-gray-200">{customer.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-600 dark:text-gray-400 font-mono">{customer.phone}</td>
                                        <td className="p-4 text-sm text-gray-500 truncate max-w-[200px]">{customer.address}</td>
                                        <td className="p-4 text-right font-black text-red-600 font-mono text-lg">₱{bal.toLocaleString()}</td>
                                        {isAdmin && (
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleEdit(customer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={18} /></button>
                                                    <button onClick={() => handleDelete(customer.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"><ChevronLeft size={16} /></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>
            )}

            {/* Floating Action Button */}
            {isAdmin && (
                <button 
                    onClick={openAddModal}
                    className="fixed bottom-[140px] right-6 md:bottom-28 md:right-10 w-16 h-16 bg-blue-600 text-white rounded-full shadow-[0_8px_30px_rgb(37,99,235,0.4)] flex items-center justify-center hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all z-40 animate-in zoom-in duration-300"
                    title="Add Customer"
                >
                    <Plus size={36} strokeWidth={3} />
                </button>
            )}

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 border border-white/10">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight">{editingCustomer ? 'Update Client' : 'New Client'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Full Legal Name</label>
                                <input required type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-xl outline-none transition-all dark:text-white" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Juan De La Cruz" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Mobile Number</label>
                                <input required type="tel" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-xl outline-none transition-all dark:text-white font-mono" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="09XX XXX XXXX" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Billing Address</label>
                                <input type="text" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-xl outline-none transition-all dark:text-white" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Street, Barangay, City" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Email Address (Optional)</label>
                                <input type="email" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-blue-500 rounded-xl outline-none transition-all dark:text-white" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="client@example.com" />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all mt-4">
                                {editingCustomer ? 'Update Account' : 'Register Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

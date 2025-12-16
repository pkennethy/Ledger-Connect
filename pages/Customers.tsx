import React, { useState, useMemo } from 'react';
import { Search, Plus, Phone, Edit, Trash2, User as UserIcon, MessageSquare, X, LayoutGrid, LayoutList } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Customer, Language, DICTIONARY, User, UserRole } from '../types';
import { useToast } from '../context/ToastContext';

// Helpers
const getTodayString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

const getLocalDateFromISO = (iso: string) => {
    const d = new Date(iso);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
};

interface PageProps {
    lang: Language;
    user: User;
}

export const Customers: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const { showToast } = useToast();
    const isAdmin = user.role === UserRole.ADMIN;

    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [customers, setCustomers] = useState(MockService.getCustomers());
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState<Partial<Customer>>({});

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone?.includes(searchTerm)
        );
    }, [customers, searchTerm]);

    const handleSendSMS = (customer: Customer, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!customer.phone) {
            showToast(`No phone number for ${customer.name}`, 'error');
            return;
        }

        const targetDate = getTodayString();
        const dateObj = new Date(targetDate);
        const dateDisplay = dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        const rawDebts = MockService.getDebts(customer.id);
        const rawPayments = MockService.getRepayments(customer.id);

        const categories = Array.from(new Set([
            ...rawDebts.map(d => d.category),
            ...rawPayments.map(p => p.category)
        ])).sort();

        let grandTotal = 0;
        const breakdownLines: string[] = [];

        categories.forEach(cat => {
            const prevDebts = rawDebts.filter(d => d.category === cat && getLocalDateFromISO(d.createdAt) < targetDate);
            const prevPayments = rawPayments.filter(p => p.category === cat && getLocalDateFromISO(p.timestamp) < targetDate);
            
            const prevBal = prevDebts.reduce((sum, d) => sum + d.amount, 0) - prevPayments.reduce((sum, p) => sum + p.amount, 0);

            const currDebts = rawDebts.filter(d => d.category === cat && getLocalDateFromISO(d.createdAt) === targetDate);
            const currPayments = rawPayments.filter(p => p.category === cat && getLocalDateFromISO(p.timestamp) === targetDate);

            const totalNewCharges = currDebts.reduce((sum, d) => sum + d.amount, 0);
            const totalNewPayments = currPayments.reduce((sum, p) => sum + p.amount, 0);
            
            const endBal = prevBal + totalNewCharges - totalNewPayments;

            if (Math.abs(endBal) > 0.01 || totalNewCharges > 0 || totalNewPayments > 0) {
                breakdownLines.push(`[${cat}]`);
                if (Math.abs(prevBal) > 0.01) {
                    breakdownLines.push(`  Beg: P${prevBal.toLocaleString()}`);
                }

                const timeline: {ts: number, text: string}[] = [];

                currDebts.forEach(d => { 
                    const timeStr = new Date(d.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    d.items.forEach(i => { 
                        const itemTotal = i.price * i.quantity; 
                        timeline.push({
                            ts: new Date(d.createdAt).getTime(),
                            text: `  ${timeStr} - ${i.productName} (x${i.quantity}): P${itemTotal.toLocaleString()}`
                        });
                    }); 
                });

                currPayments.forEach(p => {
                    const timeStr = new Date(p.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    timeline.push({
                        ts: new Date(p.timestamp).getTime(),
                        text: `  ${timeStr} - Paid: P${p.amount.toLocaleString()}`
                    });
                });

                timeline.sort((a, b) => a.ts - b.ts).forEach(t => breakdownLines.push(t.text));

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
        
        // Append App Link (Clean Base URL)
        const appLink = window.location.href.split('#')[0];
        message += `\n\nLogin: ${appLink}`;

        const ua = navigator.userAgent.toLowerCase();
        const isiOS = /iphone|ipad|ipod/.test(ua);
        const separator = isiOS ? '&' : '?';
        const cleanPhone = customer.phone.replace(/[^0-9+]/g, '');

        window.location.href = `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!formData.name || !formData.phone) {
            showToast('Name and Phone are required', 'error');
            return;
        }

        try {
            if (editingCustomer) {
                await MockService.updateCustomer(editingCustomer.id, formData);
                showToast('Customer updated', 'success');
            } else {
                await MockService.addCustomer({
                    id: `c-${Date.now()}`,
                    name: formData.name,
                    phone: formData.phone,
                    address: formData.address || '',
                    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name)}&background=random`,
                    totalDebt: 0,
                    role: UserRole.CUSTOMER,
                    ...formData
                } as Customer);
                showToast('Customer added', 'success');
            }
            setCustomers([...MockService.getCustomers()]);
            setShowModal(false);
        } catch (error) {
            showToast('Failed to save customer', 'error');
        }
    };

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if(confirm('Are you sure you want to delete this customer?')) {
            await MockService.deleteCustomer(id);
            setCustomers([...MockService.getCustomers()]);
            showToast('Customer deleted', 'success');
        }
    };

    const openAddModal = () => {
        setEditingCustomer(null);
        setFormData({});
        setShowModal(true);
    };

    const openEditModal = (c: Customer, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingCustomer(c);
        setFormData(c);
        setShowModal(true);
    };

    return (
        <div className="space-y-6 pb-20">
            {/* STICKY HEADER */}
            <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md -mx-4 px-4 pt-1 pb-2 shadow-sm transition-all">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">{t.customers}<span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{customers.length}</span></h2>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                        <div className="relative flex-1 xl:w-64"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><LayoutList size={18} /></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><LayoutGrid size={18} /></button>
                        </div>
                        {isAdmin && (
                            <button onClick={openAddModal} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700 shadow-sm"><Plus size={16} className="mr-1" /> Add</button>
                        )}
                    </div>
                </div>
            </div>

            {/* List / Grid View */}
            {viewMode === 'list' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCustomers.map(c => (
                        <div key={c.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex items-center space-x-4">
                            <img 
                                src={c.avatarUrl} 
                                alt={c.name} 
                                className="w-12 h-12 rounded-full object-cover border border-gray-200"
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-gray-800 dark:text-white truncate">{c.name}</h3>
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <Phone size={12} className="mr-1" />
                                    {c.phone}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    Debt: <span className={c.totalDebt > 0 ? "text-red-500 font-bold" : "text-green-500"}>₱{c.totalDebt.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                {isAdmin && (
                                    <>
                                        <button onClick={(e) => handleSendSMS(c, e)} className="p-2 text-green-600 bg-green-50 rounded-full hover:bg-green-100" title="Send SMS Reminder"><MessageSquare size={16} /></button>
                                        <button onClick={(e) => openEditModal(c, e)} className="p-2 text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100"><Edit size={16} /></button>
                                        <button onClick={(e) => handleDelete(c.id, e)} className="p-2 text-red-600 bg-red-50 rounded-full hover:bg-red-100"><Trash2 size={16} /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                    {filteredCustomers.map(cust => (
                        <div key={cust.id} className="relative aspect-square bg-gray-200 rounded-xl overflow-hidden group shadow-sm">
                            <img src={cust.avatarUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={cust.name} />
                            
                            {/* Overlay Gradient */}
                            <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />
                            
                            {/* Actions Top Right (Visible on Hover/Touch) */}
                            {isAdmin && (
                                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={(e) => openEditModal(cust, e)} className="bg-white/90 p-1.5 rounded-full text-blue-600 shadow-sm backdrop-blur-sm hover:scale-110 transition-transform"><Edit size={14} /></button>
                                    <button onClick={(e) => handleDelete(cust.id, e)} className="bg-white/90 p-1.5 rounded-full text-red-600 shadow-sm backdrop-blur-sm hover:scale-110 transition-transform"><Trash2 size={14} /></button>
                                </div>
                            )}

                            {/* Status Badge */}
                            <div className={`absolute top-2 left-2 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm z-10 uppercase tracking-wider ${cust.totalDebt > 0 ? 'bg-red-600/90' : 'bg-green-600/90'}`}>
                                {cust.totalDebt > 0 ? `Due: ₱${cust.totalDebt.toLocaleString()}` : 'Good'}
                            </div>

                            {/* Bottom Info */}
                            <div className="absolute bottom-0 left-0 w-full p-3 flex flex-col justify-end z-10">
                                <div className="text-white font-bold text-lg leading-none mb-1 drop-shadow-md truncate">{cust.name}</div>
                                <div className="flex items-center text-white/80 text-[10px] font-medium mb-2"><Phone size={10} className="mr-1" />{cust.phone}</div>
                                
                                {/* Quick Action */}
                                {isAdmin && (
                                    <button 
                                        onClick={(e) => handleSendSMS(cust, e)} 
                                        className="bg-white/20 hover:bg-white/30 text-white border border-white/40 py-1.5 rounded-lg backdrop-blur-md shadow-sm transition-all active:scale-95 text-xs font-bold flex items-center justify-center gap-1"
                                    >
                                        <MessageSquare size={12} /> Send SMS
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                 <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20} className="text-gray-400" /></button>
                        </div>
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Name</label>
                                <input 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={formData.name || ''} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    placeholder="Juan Cruz"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                                <input 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={formData.phone || ''} 
                                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                                    placeholder="0917 123 4567"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Address</label>
                                <input 
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                                    value={formData.address || ''} 
                                    onChange={e => setFormData({...formData, address: e.target.value})} 
                                    placeholder="City, Province"
                                />
                            </div>
                            <button type="submit" className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/30 mt-2">
                                Save Customer
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
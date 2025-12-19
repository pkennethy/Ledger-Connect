
import React, { useState, useMemo, useEffect } from 'react';
import { Search, FileText, ChevronDown, ChevronRight, Plus, X, Wallet, AlertCircle, History, Calendar, Mail, PenTool, ShoppingBag, LayoutGrid, LayoutList, Phone, User as UserIcon, Clock, ArrowRight as ArrowIcon, ArrowDownLeft, ArrowUpRight, Printer, Download, MessageSquare, Minus, Trash2, ChevronLeft, ChevronDown as ChevronDownIcon, ChevronUp, GripVertical, Check, ShoppingCart, Package, List, Grip, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, DebtRecord, DebtStatus, Customer, Product, User, UserRole, RepaymentRecord, OrderItem } from '../types';
import { useToast } from '../context/ToastContext';
import { NumpadModal } from '../components/NumpadModal';

interface PageProps {
    lang: Language;
    user: User;
}

export const Debts: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;
    const { showToast } = useToast();

    // --- UI HELPERS ---
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

    const getCardStyle = (index: number) => {
        const styles = [
            'bg-gradient-to-br from-pink-500 to-rose-600',
            'bg-gradient-to-br from-blue-500 to-blue-700',
            'bg-gradient-to-br from-orange-400 to-orange-600',
            'bg-gradient-to-br from-purple-500 to-purple-700',
            'bg-gradient-to-br from-emerald-500 to-teal-700',
            'bg-gradient-to-br from-cyan-500 to-blue-600',
            'bg-gradient-to-br from-indigo-500 to-indigo-700',
            'bg-gradient-to-br from-rose-400 to-red-600',
        ];
        return styles[index % styles.length];
    };

    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getLocalDateFromISO = (isoDate: string) => {
        const d = new Date(isoDate);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // UI View State
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [mainDateFilter, setMainDateFilter] = useState(''); 
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [addDebtStep, setAddDebtStep] = useState<'select' | 'assign'>('select');
    const [shopSubTab, setShopSubTab] = useState<'products' | 'cart'>('products');
    const [showRepayModal, setShowRepayModal] = useState(false);
    const [viewingTxnItems, setViewingTxnItems] = useState<any | null>(null);
    
    // Delete Confirmation State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{id: string, type: 'DEBT' | 'PAYMENT'} | null>(null);
    const [deletePassInput, setDeletePassInput] = useState('');
    const [showDeletePass, setShowDeletePass] = useState(false);

    // Numpad State
    const [showNumpad, setShowNumpad] = useState(false);
    const [numpadTargetId, setNumpadTargetId] = useState<string | null>(null);
    const [numpadInitialValue, setNumpadInitialValue] = useState(1);

    // Detail View State 
    const [selectedDetailCustomer, setSelectedDetailCustomer] = useState<any | null>(null);
    const [detailDateFilter, setDetailDateFilter] = useState(getTodayString());
    
    // SOA Modal State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState<{
        customer: Customer, 
        categories: any[], 
        grandTotal: number, 
        date: string
    } | null>(null);

    const [refresh, setRefresh] = useState(0);

    // Form States
    const [addDebtMode, setAddDebtMode] = useState<'product' | 'manual'>('product');
    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [selectedProducts, setSelectedProducts] = useState<Array<{product: Product, qty: number}>>([]);
    const [debtAssignments, setDebtAssignments] = useState<Record<string, string>>({}); // ProductID -> Category
    const [debtDate, setDebtDate] = useState('');
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [shopSearch, setShopSearch] = useState('');
    const [shopCategory, setShopCategory] = useState('All');
    const [manualForm, setManualForm] = useState({ amount: '', category: '', description: '' });
    const [repayCustomer, setRepayCustomer] = useState<string>('');
    const [repayCategory, setRepayCategory] = useState<string>('');
    const [repayAmount, setRepayAmount] = useState<string>('');

    // --- DRAG AND DROP STATE ---
    const [draggedTxnId, setDraggedTxnId] = useState<string | null>(null);
    const [draggedTxnType, setDraggedTxnType] = useState<'DEBT' | 'PAYMENT' | null>(null);
    const [dropOverCategory, setDropOverCategory] = useState<string | null>(null);
    const [isOverTrash, setIsOverTrash] = useState(false);

    // --- EFFECTS ---
    useEffect(() => {
        setAllProducts(MockService.getProducts());
    }, [refresh]);

    useEffect(() => {
        if (showAddModal) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            setDebtDate(now.toISOString().slice(0, 16));
            setAddDebtStep('select');
            setShopSubTab('products');
        }
    }, [showAddModal]);

    useEffect(() => {
        if (selectedDetailCustomer) {
            setDetailDateFilter(getTodayString());
        }
    }, [selectedDetailCustomer]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, mainDateFilter]);

    // --- DATA PREPARATION ---
    let visibleCustomers = MockService.getCustomers().filter(c => c.role !== UserRole.ADMIN);
    if (!isAdmin) {
        visibleCustomers = visibleCustomers.filter(c => c.id === user.id);
    } else {
        visibleCustomers = visibleCustomers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    const calculateHistoricalTotal = (customerId: string, dateLimit: string) => {
        const rawDebts = MockService.getDebts(customerId);
        const rawPayments = MockService.getRepayments(customerId);
        const debtsUntilDate = rawDebts.filter(d => getLocalDateFromISO(d.createdAt) <= dateLimit);
        const paymentsUntilDate = rawPayments.filter(p => getLocalDateFromISO(p.timestamp) <= dateLimit);
        const totalDebt = debtsUntilDate.reduce((sum, d) => sum + d.amount, 0);
        const totalPaid = paymentsUntilDate.reduce((sum, p) => sum + p.amount, 0);
        return totalDebt - totalPaid;
    };

    const customerDebts = useMemo(() => {
        return visibleCustomers.map(cust => {
            const debts = MockService.getDebts(cust.id);
            const categories: Record<string, DebtRecord[]> = {};
            debts.forEach(d => {
                if (!categories[d.category]) categories[d.category] = [];
                categories[d.category].push(d);
            });
            let displayDebt = cust.totalDebt;
            if (mainDateFilter) {
                displayDebt = calculateHistoricalTotal(cust.id, mainDateFilter);
            }
            return { ...cust, debts, categories, displayDebt };
        }).sort((a, b) => b.displayDebt - a.displayDebt);
    }, [visibleCustomers, mainDateFilter, refresh]);

    const totalPages = Math.ceil(customerDebts.length / itemsPerPage);
    const paginatedDebts = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return customerDebts.slice(start, start + itemsPerPage);
    }, [customerDebts, currentPage]);

    const categorySuggestions = useMemo(() => {
        const cats = new Set<string>();
        MockService.getDebts().forEach(d => cats.add(d.category));
        MockService.getProducts().forEach(p => cats.add(p.category));
        return Array.from(cats).sort();
    }, [refresh]);

    const filteredShopProducts = useMemo(() => {
        return allProducts.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(shopSearch.toLowerCase());
            const matchesCategory = shopCategory === 'All' || p.category === shopCategory;
            return matchesSearch && matchesCategory;
        });
    }, [allProducts, shopSearch, shopCategory]);

    const productCategories = useMemo(() => {
        const cats = new Set(allProducts.map(p => p.category));
        return ['All', ...Array.from(cats).sort()];
    }, [allProducts]);

    // --- DRAG AND DROP HANDLERS ---
    const onDragStart = (e: React.DragEvent, id: string, type: 'DEBT' | 'PAYMENT') => {
        setDraggedTxnId(id);
        setDraggedTxnType(type);
        e.dataTransfer.setData('id', id);
        e.dataTransfer.setData('type', type);
        e.dataTransfer.effectAllowed = 'move';
        
        // Custom drag ghost
        const ghost = document.createElement('div');
        ghost.textContent = `Moving ${type === 'DEBT' ? 'Debt' : 'Payment'}...`;
        ghost.style.padding = '10px 16px';
        ghost.style.background = type === 'DEBT' ? '#ef4444' : '#10b981';
        ghost.style.color = 'white';
        ghost.style.fontWeight = 'bold';
        ghost.style.borderRadius = '24px';
        ghost.style.position = 'absolute';
        ghost.style.top = '-1000px';
        ghost.style.zIndex = '9999';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const onDragOver = (e: React.DragEvent, category: string) => {
        e.preventDefault();
        // Only debts can be moved between categories
        if (draggedTxnType === 'DEBT' && dropOverCategory !== category) {
            setDropOverCategory(category);
        }
    };

    const onDrop = async (e: React.DragEvent, targetCategory: string) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('id') || draggedTxnId;
        const type = e.dataTransfer.getData('type') || draggedTxnType;
        
        // Only debts can be re-categorized
        if (id && type === 'DEBT') {
            try {
                await MockService.updateDebtCategory(id, targetCategory);
                showToast(`Moved to ${targetCategory}`, 'success');
                setRefresh(prev => prev + 1);
            } catch (error) {
                showToast('Failed to move record', 'error');
            }
        } else if (type === 'PAYMENT') {
            showToast('Payments cannot be moved between categories manually', 'info');
        }
        
        setDraggedTxnId(null);
        setDraggedTxnType(null);
        setDropOverCategory(null);
        setIsOverTrash(false);
    };

    const onDragOverTrash = (e: React.DragEvent) => {
        e.preventDefault();
        if (!isOverTrash) setIsOverTrash(true);
    };

    const onDropTrash = async (e: React.DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('id') || draggedTxnId;
        const type = e.dataTransfer.getData('type') as 'DEBT' | 'PAYMENT' || draggedTxnType;

        if (id && type) {
            setDeleteTarget({ id, type });
            setShowDeleteModal(true);
            setDeletePassInput('');
            setShowDeletePass(false);
        }
        
        setDraggedTxnId(null);
        setDraggedTxnType(null);
        setIsOverTrash(false);
        setDropOverCategory(null);
    };

    const onDragEnd = () => {
        setDraggedTxnId(null);
        setDraggedTxnType(null);
        setDropOverCategory(null);
        setIsOverTrash(false);
    };

    const handleManualDelete = (tx: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteTarget({ id: tx.id, type: tx.type });
        setShowDeleteModal(true);
        setDeletePassInput('');
        setShowDeletePass(false);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        
        // Trim input to prevent errors from trailing spaces
        const trimmedInput = deletePassInput.trim();
        
        // Robust check: if user.password is missing, find it from the master customers list
        let correctPassword = user.password;
        if (!correctPassword) {
            const masterUser = MockService.getCustomers().find(c => c.id === user.id);
            correctPassword = masterUser?.password;
        }

        // Fallback for Supabase environments where password isn't in profile but used for Auth
        if (!correctPassword) {
            showToast('Session error: Deletion password not found. Please log out and log back in to refresh your credentials.', 'error');
            return;
        }

        if (trimmedInput !== correctPassword) {
            showToast('Incorrect deletion password', 'error');
            return;
        }

        try {
            if (deleteTarget.type === 'DEBT') {
                await MockService.deleteDebt(deleteTarget.id);
            } else {
                await MockService.deleteRepayment(deleteTarget.id);
            }
            showToast('Record deleted successfully', 'success');
            setRefresh(prev => prev + 1);
            setShowDeleteModal(false);
            setDeleteTarget(null);
            setDeletePassInput('');
        } catch (error) {
            showToast('Failed to delete record', 'error');
        }
    };

    // --- RENDER HELPERS ---
    const handleCustomerClick = (wrapper: any) => {
        setSelectedDetailCustomer(wrapper);
    };

    const renderLedgerList = (customerId: string) => {
        const rawDebts = MockService.getDebts(customerId);
        const rawPayments = MockService.getRepayments(customerId);
        const categories = Array.from(new Set([...rawDebts.map(d => d.category), ...rawPayments.map(p => p.category)])).sort();

        if (categories.length === 0) return <div className="text-center py-12 text-gray-400">No transaction history.</div>;

        return (
            <div className="space-y-6 pb-2">
                {categories.map(cat => {
                    const txns = [
                        ...rawDebts.filter(d => d.category === cat).map(d => ({ 
                            id: d.id, date: d.createdAt, type: 'DEBT' as const, items: d.items || [], 
                            amount: d.amount, desc: d.items && d.items.length > 0 ? (d.items.length === 1 ? d.items[0].productName : `${d.items[0].productName} +${d.items.length-1}`) : (d.notes || d.category)
                        })),
                        ...rawPayments.filter(p => p.category === cat).map(p => ({ 
                            id: p.id, date: p.timestamp, type: 'PAYMENT' as const, items: [],
                            amount: p.amount, desc: 'Payment Received'
                        }))
                    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    let running = 0;
                    const fullLedger = txns.map(t => { 
                        if (t.type === 'DEBT') running += t.amount; else running -= t.amount;
                        return { ...t, balance: running, debit: t.type === 'DEBT' ? t.amount : 0, credit: t.type === 'PAYMENT' ? t.amount : 0 }; 
                    });

                    let startBal = 0;
                    let displayLedger = [...fullLedger]; 
                    let categoryTotal = fullLedger.length > 0 ? fullLedger[fullLedger.length - 1].balance : 0;

                    if (detailDateFilter) {
                        const before = fullLedger.filter(t => getLocalDateFromISO(t.date) < detailDateFilter);
                        startBal = before.length > 0 ? before[before.length - 1].balance : 0;
                        const until = fullLedger.filter(t => getLocalDateFromISO(t.date) <= detailDateFilter);
                        categoryTotal = until.length > 0 ? until[until.length - 1].balance : 0;
                        displayLedger = fullLedger.filter(t => getLocalDateFromISO(t.date) === detailDateFilter);
                    }

                    if (displayLedger.length === 0 && startBal === 0) return null;

                    const isDropTarget = dropOverCategory === cat;

                    return (
                        <div 
                            key={cat} 
                            onDragOver={(e) => isAdmin && onDragOver(e, cat)}
                            onDrop={(e) => isAdmin && onDrop(e, cat)}
                            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all duration-200 overflow-hidden ${isDropTarget ? 'border-blue-500 ring-2 ring-blue-100 scale-[1.01] bg-blue-50/20' : 'border-gray-200 dark:border-gray-700'}`}
                        >
                            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-6 rounded-full transition-colors ${isDropTarget ? 'bg-blue-600 animate-pulse' : 'bg-blue-600'}`}></div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wider">{cat}</h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-bold">Outstanding</p>
                                    <p className="text-lg font-bold text-red-600 font-mono">₱{categoryTotal.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-white dark:bg-gray-800 border-b text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                                        <tr><th className="px-4 py-2 w-36">Date & Time</th><th className="px-4 py-2">Particulars</th><th className="px-4 py-2 text-right w-24">Debit</th><th className="px-4 py-2 text-right w-24">Credit</th><th className="px-4 py-2 text-right w-28">Balance</th><th className="px-2 w-10"></th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                                        {detailDateFilter && (
                                            <tr className="bg-amber-50/30 dark:bg-amber-900/10">
                                                <td className="px-4 py-2 text-xs font-mono text-gray-400">
                                                    <div className="flex items-center gap-2">
                                                        <span className="w-4 h-4"></span>
                                                        {new Date(detailDateFilter).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 italic text-gray-600 dark:text-gray-400 font-medium">Balance Forward</td>
                                                <td colSpan={2}></td>
                                                <td className="px-4 py-2 text-right font-bold font-mono">₱{startBal.toLocaleString()}</td>
                                                <td></td>
                                            </tr>
                                        )}
                                        {displayLedger.map(tx => {
                                            const isDraggable = isAdmin; // Both types draggable for deletion
                                            const isBeingDragged = draggedTxnId === tx.id;
                                            
                                            return (
                                                <tr 
                                                    key={tx.id} 
                                                    draggable={isDraggable}
                                                    onDragStart={(e) => isDraggable && onDragStart(e, tx.id, tx.type)}
                                                    onDragEnd={onDragEnd}
                                                    className={`transition-colors group ${isBeingDragged ? 'opacity-40 grayscale' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'} ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                                >
                                                    <td className="px-4 py-2 text-[10px] text-gray-500 font-mono">
                                                        <div className="flex items-center gap-2">
                                                            {isDraggable ? (
                                                                <GripVertical size={14} className="text-gray-300" />
                                                            ) : (
                                                                <span className="w-[14px]"></span>
                                                            )}
                                                            <div>
                                                                <div>{new Date(tx.date).toLocaleDateString()}</div>
                                                                <div className="text-gray-400">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">
                                                        {tx.items && tx.items.length > 0 ? (
                                                            <button 
                                                                onClick={() => setViewingTxnItems(tx)}
                                                                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline text-left group/btn"
                                                            >
                                                                <List size={14} className="opacity-50 group-hover/btn:opacity-100" />
                                                                {tx.desc}
                                                            </button>
                                                        ) : (
                                                            tx.desc
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-right text-red-600 font-mono">{tx.debit > 0 ? `₱${tx.debit.toLocaleString()}` : ''}</td>
                                                    <td className="px-4 py-2 text-right text-green-600 font-mono">{tx.credit > 0 ? `₱${tx.credit.toLocaleString()}` : ''}</td>
                                                    <td className="px-4 py-2 text-right font-bold font-mono">₱{tx.balance.toLocaleString()}</td>
                                                    <td className="px-2">
                                                        {isAdmin && (
                                                            <button 
                                                                onClick={(e) => handleManualDelete(tx, e)}
                                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                                                title="Delete Record"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // --- ACTIONS ---
    const generateReport = (customerId: string) => {
        const cust = MockService.getCustomers().find(c => c.id === customerId);
        if (!cust) return;
        const targetDate = detailDateFilter || getTodayString();
        
        const rawDebts = MockService.getDebts(customerId);
        const rawPayments = MockService.getRepayments(customerId);
        const categories = Array.from(new Set([...rawDebts.map(d => d.category), ...rawPayments.map(p => p.category)])).sort();

        const reportCategories = categories.map(cat => {
            const prevDebts = rawDebts.filter(d => d.category === cat && getLocalDateFromISO(d.createdAt) < targetDate);
            const prevPayments = rawPayments.filter(p => p.category === cat && getLocalDateFromISO(p.timestamp) < targetDate);
            const opening = prevDebts.reduce((s, d) => s + d.amount, 0) - prevPayments.reduce((s, p) => s + p.amount, 0);

            const currDebts = rawDebts.filter(d => d.category === cat && getLocalDateFromISO(d.createdAt) === targetDate);
            const currPayments = rawPayments.filter(p => p.category === cat && getLocalDateFromISO(p.timestamp) === targetDate);
            
            const added = currDebts.reduce((s, d) => s + d.amount, 0);
            const paid = currPayments.reduce((s, p) => s + p.amount, 0);
            const closing = opening + added - paid;

            return { name: cat, opening, added, paid, closing, debts: currDebts, payments: currPayments };
        }).filter(c => c.opening !== 0 || c.added !== 0 || c.paid !== 0);

        const grandTotal = reportCategories.reduce((s, c) => s + c.closing, 0);

        setReportData({ customer: cust, categories: reportCategories, grandTotal, date: targetDate });
        setShowReportModal(true);
    };

    const handleSendSMS = (customer: Customer) => {
        if (!customer.phone) {
            showToast(`No phone number for ${customer.name}`, 'error');
            return;
        }

        const targetDate = detailDateFilter || getTodayString();
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
                    if (d.items && d.items.length > 0) {
                        d.items.forEach(i => { 
                            const itemTotal = i.price * i.quantity; 
                            timeline.push({
                                ts: new Date(d.createdAt).getTime(),
                                text: `  ${timeStr} - ${i.productName} (x${i.quantity}): P${itemTotal.toLocaleString()}`
                            });
                        });
                    } else {
                        // Manual Entry -> Use notes if available
                        const desc = d.notes ? d.notes : 'Manual Entry';
                        timeline.push({
                            ts: new Date(d.createdAt).getTime(),
                            text: `  ${timeStr} - ${desc}: P${d.amount.toLocaleString()}`
                        });
                    }
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
        
        const ua = navigator.userAgent.toLowerCase();
        const isiOS = /iphone|ipad|ipod/.test(ua);
        const separator = isiOS ? '&' : '?';
        const cleanPhone = customer.phone.replace(/[^0-9+]/g, '');

        window.location.href = `sms:${cleanPhone}${separator}body=${encodeURIComponent(message)}`;
    };

    const handleAddProduct = (pid: string) => {
        const p = allProducts.find(x => x.id === pid);
        if (!p) return;
        const ex = selectedProducts.find(x => x.product.id === pid);
        if (ex) setSelectedProducts(selectedProducts.map(x => x.product.id === pid ? { ...x, qty: x.qty + 1 } : x));
        else setSelectedProducts([...selectedProducts, { product: p, qty: 1 }]);
        showToast('Added to queue', 'info');
    };

    const handleRemoveProduct = (pid: string) => {
        setSelectedProducts(selectedProducts.filter(p => p.product.id !== pid));
    };

    const handleUpdateQty = (pid: string, delta: number) => {
        setSelectedProducts(selectedProducts.map(i => i.product.id === pid ? { ...i, qty: Math.max(1, i.qty + delta) } : i));
    };

    const openNumpad = (pid: string, currentQty: number) => {
        setNumpadTargetId(pid);
        setNumpadInitialValue(currentQty);
        setShowNumpad(true);
    };

    const handleProceedToAssign = () => {
        if (!selectedCustomer) { showToast('Please select a customer', 'error'); return; }
        if (selectedProducts.length === 0) { showToast('Please select products', 'error'); return; }
        
        const initial: Record<string, string> = {};
        selectedProducts.forEach(item => {
            const last = MockService.getLastUsedCategory(selectedCustomer, item.product.id);
            initial[item.product.id] = last || item.product.category;
        });
        setDebtAssignments(initial);
        setAddDebtStep('assign');
    };

    const submitDebt = () => {
        if (!selectedCustomer) return showToast('Select Customer', 'error');
        const createdAt = debtDate ? new Date(debtDate).toISOString() : new Date().toISOString();
        
        if (addDebtMode === 'manual') {
            if (!manualForm.amount) return;
            MockService.createDebt({ 
                id: `d-${Date.now()}`, 
                customerId: selectedCustomer, 
                amount: parseFloat(manualForm.amount), 
                paidAmount: 0, 
                items: [], 
                category: manualForm.category || 'General', 
                createdAt, 
                status: DebtStatus.UNPAID,
                notes: manualForm.description
            });
        } else {
            const itemsByCategory: Record<string, any[]> = {};
            selectedProducts.forEach(item => {
                const cat = debtAssignments[item.product.id] || item.product.category;
                if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
                itemsByCategory[cat].push({
                    productId: item.product.id,
                    productName: item.product.name,
                    quantity: item.qty,
                    price: item.product.price,
                    category: cat
                });
            });

            Object.entries(itemsByCategory).forEach(([cat, items]) => {
                const total = items.reduce((s, i) => s + (i.price * i.quantity), 0);
                MockService.createDebt({ 
                    id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, 
                    customerId: selectedCustomer, 
                    amount: total, 
                    paidAmount: 0, 
                    items: items, 
                    category: cat, 
                    createdAt, 
                    status: DebtStatus.UNPAID 
                });
            });
        }
        
        setShowAddModal(false); 
        setSelectedProducts([]); 
        setRefresh(r => r + 1); 
        showToast('Debt Recorded', 'success');
    };

    const submitRepayment = () => {
        if (!repayCustomer || !repayAmount || !repayCategory) return;
        MockService.repayDebtByCategory(repayCustomer, repayCategory, parseFloat(repayAmount));
        setShowRepayModal(false); setRefresh(r => r + 1); showToast('Payment Recorded', 'success');
    };

    return (
        <div className="space-y-4 relative min-h-full">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md -mx-4 px-4 pt-1 pb-2 shadow-sm">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">{t.debts}<span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">{customerDebts.length}</span></h2>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                        <div className="relative flex-1 xl:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search..." 
                                className="w-full pl-9 pr-10 py-2 text-sm rounded-full bg-gray-100 dark:bg-gray-700 border-none outline-none font-medium" 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
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
                        <div className="relative flex items-center bg-gray-100 dark:bg-gray-700 rounded-full px-2">
                            <Calendar size={16} className="text-gray-400 ml-1" />
                            <input type="date" className="bg-transparent border-none text-sm py-2 w-32 focus:ring-0" value={mainDateFilter} onChange={e => setMainDateFilter(e.target.value)} />
                            {mainDateFilter && <button onClick={() => setMainDateFilter('')}><X size={14} className="text-gray-500" /></button>}
                        </div>
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><LayoutList size={18} /></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><LayoutGrid size={18} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {paginatedDebts.map((c, idx) => {
                        const hasDebt = c.displayDebt > 0;
                        const style = hasDebt ? getCardStyle(idx) : 'bg-gradient-to-br from-green-500 to-green-700';
                        return (
                            <div key={c.id} onClick={() => handleCustomerClick(c)} className={`relative aspect-[4/5] rounded-3xl p-5 shadow-lg flex flex-col justify-between overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform ${style}`}>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-[8rem] font-bold text-white opacity-10 select-none transform -rotate-12 scale-150">{getInitials(c.name)}</span></div>
                                <div className="relative z-10 flex justify-between items-start">
                                    <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold shadow-sm backdrop-blur-md ${hasDebt ? 'bg-red-600/90 text-white' : 'bg-green-800/80 text-white'}`}>
                                        {hasDebt ? `DUE: ₱${c.displayDebt.toLocaleString()}` : 'CLEAN'}
                                    </div>
                                </div>
                                <div className="relative z-10 flex items-end justify-between mt-auto">
                                    <div className="flex-1 min-w-0 mr-2">
                                        <h3 className="text-xl font-bold text-white truncate drop-shadow-md">{c.name}</h3>
                                        <div className="flex items-center gap-1 text-white/90 mt-1"><Phone size={12} fill="currentColor" /><span className="text-xs font-medium truncate">{c.phone}</span></div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setRepayCustomer(c.id); setShowRepayModal(true); }} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white hover:text-blue-600 transition-colors shadow-inner border border-white/30 shrink-0"><Wallet size={18} /></button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-2">
                    {paginatedDebts.map(c => (
                        <div key={c.id} onClick={() => handleCustomerClick(c)} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">{getInitials(c.name)}</div>
                                <div><h4 className="font-bold text-gray-800 dark:text-white">{c.name}</h4><p className="text-xs text-gray-500">{c.phone}</p></div>
                            </div>
                            <div className="text-right">
                                <p className={`font-bold ${c.displayDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>₱{c.displayDebt.toLocaleString()}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mt-4">
                    <p className="text-xs text-gray-500 font-medium">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"><ChevronLeft size={16} /></button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>
            )}

            {/* FLOATING ACTION BUTTON */}
            {isAdmin && !selectedDetailCustomer && (
                <button 
                    onClick={() => { setSelectedCustomer(''); setShowAddModal(true); }}
                    className="fixed bottom-[140px] right-6 md:bottom-28 md:right-10 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-700 hover:scale-110 transition-all z-40 animate-in zoom-in duration-300"
                    title="Add Debt"
                >
                    <Plus size={32} strokeWidth={3} />
                </button>
            )}

            {/* FULL SCREEN DETAIL VIEW */}
            {selectedDetailCustomer && (
                <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col animate-in slide-in-from-right duration-200">
                    <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 shadow-sm shrink-0 z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-3 items-center">
                                <button onClick={() => setSelectedDetailCustomer(null)} className="mr-1 text-gray-500"><ChevronLeft size={28} /></button>
                                <div className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center text-lg font-bold ring-4 ring-orange-100 dark:ring-orange-900/30">{getInitials(selectedDetailCustomer.name)}</div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-none mb-1">{selectedDetailCustomer.name}</h2>
                                    <p className="text-sm text-gray-500">Balance: <span className="font-bold text-red-600 text-lg">₱{selectedDetailCustomer.displayDebt.toLocaleString()}</span></p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDetailCustomer(null)} className="bg-gray-100 dark:bg-gray-700 p-2 rounded-full text-gray-500"><X size={20} /></button>
                        </div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                <input type="date" className="pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm border-none outline-none dark:text-white" value={detailDateFilter} onChange={e => setDetailDateFilter(e.target.value)} />
                            </div>
                            {detailDateFilter && <button onClick={() => setDetailDateFilter(getTodayString())} className="text-sm text-blue-600 font-bold hover:underline">Reset Today</button>}
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                             <button onClick={() => handleSendSMS(selectedDetailCustomer)} className="p-3 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300"><MessageSquare size={20} /></button>
                             <button onClick={() => { setRepayCustomer(selectedDetailCustomer.id); setRepayCategory(''); setShowRepayModal(true); }} className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-blue-500/20"><Wallet size={18} /> Repay</button>
                             <button onClick={() => { setSelectedCustomer(selectedDetailCustomer.id); setShowAddModal(true); setAddDebtMode('product'); }} className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-red-500/20"><Plus size={18} /> Add Debt</button>
                             <button onClick={() => generateReport(selectedDetailCustomer.id)} className="px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-300"><FileText size={18} /></button>
                        </div>
                    </div>
                    {/* pb-[130px] ensures Detail View content isn't covered by ad/nav bar */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[130px] bg-gray-50/50 dark:bg-gray-900/50">
                        {renderLedgerList(selectedDetailCustomer.id)}
                    </div>
                    
                    {/* TRASH DROP ZONE (Visible during Drag) */}
                    {draggedTxnId && (
                        <div 
                            onDragOver={onDragOverTrash}
                            onDragLeave={() => setIsOverTrash(false)}
                            onDrop={onDropTrash}
                            className={`fixed bottom-0 inset-x-0 h-32 z-[100] transition-all duration-300 flex flex-col items-center justify-center gap-2 ${isOverTrash ? 'bg-red-600 text-white shadow-[0_-10px_30px_rgba(220,38,38,0.5)]' : 'bg-red-500/90 text-white backdrop-blur-md shadow-[0_-5px_20px_rgba(0,0,0,0.2)]'}`}
                        >
                            <Trash2 size={40} className={`transition-transform duration-300 ${isOverTrash ? 'scale-125 rotate-12' : 'animate-bounce'}`} />
                            <p className="font-black uppercase tracking-widest text-sm drop-shadow-md">{isOverTrash ? 'Release to Delete' : `Drop ${draggedTxnType === 'DEBT' ? 'Debt' : 'Payment'} here to Delete`}</p>
                        </div>
                    )}
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95 duration-200 text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ShieldAlert size={32} />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Confirm Deletion</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">You are about to permanently remove a financial record. Please enter your <b>Admin Password</b> to proceed.</p>
                        
                        <div className="space-y-4">
                            <div className="relative">
                                <input 
                                    type={showDeletePass ? "text" : "password"} 
                                    autoFocus
                                    placeholder="Enter password"
                                    value={deletePassInput}
                                    onChange={(e) => setDeletePassInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && confirmDelete()}
                                    className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-center font-bold outline-none focus:border-red-500 transition-all dark:text-white pr-12"
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowDeletePass(!showDeletePass)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showDeletePass ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeletePassInput(''); }}
                                    className="flex-1 py-3.5 rounded-xl font-bold text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    className="flex-1 py-3.5 rounded-xl font-bold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30 uppercase tracking-widest"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TRANSACTION ITEMS MODAL */}
            {viewingTxnItems && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                            <div>
                                <h3 className="font-black text-gray-800 dark:text-white uppercase tracking-wider text-sm">Transaction Breakdown</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase">{new Date(viewingTxnItems.date).toLocaleString()}</p>
                            </div>
                            <button onClick={() => setViewingTxnItems(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            <table className="w-full text-left text-sm border-collapse">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b dark:border-gray-700">
                                    <tr><th className="px-3 py-2">Item Name</th><th className="px-3 py-2 text-center">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {viewingTxnItems.items.map((item: OrderItem, idx: number) => (
                                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="px-3 py-3 font-bold text-gray-800 dark:text-gray-200">{item.productName}</td>
                                            <td className="px-3 py-3 text-center text-gray-500 font-mono">x{item.quantity}</td>
                                            <td className="px-3 py-3 text-right text-gray-500 font-mono">₱{item.price.toLocaleString()}</td>
                                            <td className="px-3 py-3 text-right font-black text-gray-900 dark:text-white font-mono">₱{(item.price * item.quantity).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50 dark:bg-gray-900 font-black border-t dark:border-gray-700">
                                    <tr>
                                        <td colSpan={3} className="px-3 py-3 text-right text-gray-500 uppercase text-[10px] tracking-widest">Grand Total</td>
                                        <td className="px-3 py-3 text-right text-red-600 text-lg font-mono">₱{viewingTxnItems.amount.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-700 flex gap-2">
                             <button onClick={() => window.print()} className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"><Printer size={16} /> Print Receipt</button>
                             <button onClick={() => setViewingTxnItems(null)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center transition-colors hover:bg-blue-700">Close View</button>
                        </div>
                    </div>
                </div>
            )}

            {/* REPAY MODAL */}
            {showRepayModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center"><Wallet size={20} className="mr-2 text-blue-600" /> Record Repayment</h3><button onClick={() => setShowRepayModal(false)}><X size={20} className="text-gray-400" /></button></div>
                        <div className="space-y-4">
                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Debt Category</label><select className="w-full p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={repayCategory} onChange={e => setRepayCategory(e.target.value)}><option value="">-- Select Category --</option>{categorySuggestions.map(cat => (<option key={cat} value={cat}>{cat}</option>))}</select></div>
                            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount to Pay</label><div className="relative"><span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">₱</span><input type="number" className="w-full pl-8 p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="0.00" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} /></div></div>
                            <button onClick={submitRepayment} className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-md transition-colors">Confirm Payment</button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ADD DEBT MODAL (MAXIMIZED POS UI) */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center sm:p-4">
                    <div className={`bg-white dark:bg-gray-800 sm:rounded-2xl shadow-2xl w-full p-0 flex flex-col overflow-hidden transition-all duration-300 ${addDebtMode === 'product' ? 'max-w-6xl h-full sm:h-[90vh]' : 'max-w-lg rounded-2xl mx-4'}`}>
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 shrink-0">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center"><Plus size={20} className="mr-2 text-blue-600" />Add Debt Record</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">
                            <div className="flex bg-gray-200 dark:bg-gray-700 p-1 rounded-lg max-w-sm mx-auto">
                                <button onClick={() => setAddDebtMode('product')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center transition-all ${addDebtMode === 'product' ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}><ShoppingBag size={14} className="mr-1.5" /> SHOP</button>
                                <button onClick={() => setAddDebtMode('manual')} className={`flex-1 py-1.5 text-xs font-bold rounded-md flex items-center justify-center transition-all ${addDebtMode === 'manual' ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}><PenTool size={14} className="mr-1.5" /> MANUAL</button>
                            </div>
                        </div>
                        {addDebtMode === 'product' && addDebtStep === 'select' && (
                            <div className="px-4 pt-3 pb-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex gap-6 shrink-0 lg:hidden overflow-x-auto">
                                <button onClick={() => setShopSubTab('products')} className={`pb-2 text-sm font-black border-b-4 transition-colors whitespace-nowrap ${shopSubTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}>BROWSE PRODUCTS</button>
                                <button onClick={() => setShopSubTab('cart')} className={`pb-2 text-sm font-black border-b-4 transition-colors flex items-center gap-2 whitespace-nowrap ${shopSubTab === 'cart' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}>MY QUEUE {selectedProducts.length > 0 && <span className="bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full">{selectedProducts.reduce((a, b) => a + b.qty, 0)}</span>}</button>
                            </div>
                        )}
                        <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30 dark:bg-gray-800/30">
                            {addDebtMode === 'product' ? (
                                addDebtStep === 'select' ? (
                                    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                                        {(shopSubTab === 'products' || window.innerWidth >= 1024) && (
                                            <div className="flex-1 flex flex-col min-h-0 p-4 border-r border-gray-100 dark:border-gray-700">
                                                <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
                                                    <select className="flex-1 p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-bold text-gray-800 dark:text-white outline-none shadow-sm focus:ring-2 focus:ring-blue-500" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}>
                                                        <option value="">-- Choose Customer --</option>
                                                        {MockService.getCustomers().map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                                                    </select>
                                                    <div className="relative flex-[2]">
                                                        <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Search products..." 
                                                            className="w-full pl-10 pr-10 py-3 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl outline-none shadow-sm focus:ring-2 focus:ring-blue-500 dark:text-white font-medium" 
                                                            value={shopSearch} 
                                                            onChange={(e) => setShopSearch(e.target.value)} 
                                                        />
                                                        {shopSearch && (
                                                            <button 
                                                                onClick={() => setShopSearch('')}
                                                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                            >
                                                                <X size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <select className="flex-1 p-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm font-medium outline-none shadow-sm focus:ring-2 focus:ring-blue-500 dark:text-white" value={shopCategory} onChange={(e) => setShopCategory(e.target.value)}>
                                                        {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex-1 overflow-y-auto pr-1 pb-4">
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                                                        {filteredShopProducts.length === 0 ? (
                                                            <div className="col-span-full py-20 text-center text-gray-400"><Package size={48} className="mx-auto mb-2 opacity-20" /><p className="text-sm">No products found</p></div>
                                                        ) : (
                                                            filteredShopProducts.map(product => {
                                                                const inCart = selectedProducts.find(p => p.product.id === product.id);
                                                                return (
                                                                    <div key={product.id} onClick={() => handleAddProduct(product.id)} className={`relative aspect-square bg-white dark:bg-gray-900 rounded-2xl overflow-hidden group shadow-md cursor-pointer transition-all active:scale-95 border-2 ${inCart ? 'border-blue-500 scale-[0.98]' : 'border-transparent hover:border-gray-200 dark:hover:border-gray-700'}`}>
                                                                        <img src={product.imageUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-90" alt="" />
                                                                        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
                                                                        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end z-10">
                                                                            {inCart && <div className="bg-blue-600 text-white text-[12px] font-black w-7 h-7 flex items-center justify-center rounded-full shadow-lg border-2 border-white animate-in zoom-in">{inCart.qty}</div>}
                                                                        </div>
                                                                        <div className="absolute bottom-0 left-0 w-full p-3 flex flex-col z-10 text-left">
                                                                            <span className="text-white/60 text-[9px] uppercase font-black tracking-widest leading-none mb-1">{product.category}</span>
                                                                            <h3 className="text-white text-xs font-bold leading-tight line-clamp-1 mb-1">{product.name}</h3>
                                                                            <div className="flex items-center justify-between mt-1">
                                                                                <span className="text-white font-black text-sm">₱{product.price.toLocaleString()}</span>
                                                                                <div className="bg-blue-600/90 text-white p-1 rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={14} strokeWidth={3} /></div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {(shopSubTab === 'cart' || window.innerWidth >= 1024) && (
                                            <div className={`flex flex-col min-h-0 bg-white dark:bg-gray-900 shadow-xl z-20 shrink-0 ${window.innerWidth < 1024 ? 'flex-1' : 'w-[360px] border-l border-gray-100 dark:border-gray-700'}`}>
                                                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                                                    <h4 className="font-black text-gray-800 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wider"><ShoppingCart size={18} className="text-blue-600" /> Transaction Queue</h4>
                                                    <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-1 rounded-full">{selectedProducts.length} ITEMS</span>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                                    {selectedProducts.length === 0 ? (
                                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs py-20 opacity-30 text-center"><ShoppingBag size={48} className="mb-4" /><p className="font-bold">YOUR QUEUE IS EMPTY<br/>Pick products from the store</p></div>
                                                    ) : (
                                                        selectedProducts.map((item) => (
                                                            <div key={item.product.id} className="flex gap-3 items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 text-left hover:border-blue-200 transition-colors">
                                                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white shadow-sm border border-gray-100 shrink-0"><img src={item.product.imageUrl} className="w-full h-full object-cover" alt="" /></div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-gray-800 dark:text-white text-[12px] truncate mb-1">{item.product.name}</p>
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            <button onClick={() => handleUpdateQty(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-red-500 active:scale-90"><Minus size={12} strokeWidth={3} /></button>
                                                                            <button onClick={() => openNumpad(item.product.id, item.qty)} className="text-[14px] font-black text-blue-600 w-6 text-center">{item.qty}</button>
                                                                            <button onClick={() => handleUpdateQty(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 text-gray-500 hover:text-green-500 active:scale-90"><Plus size={12} strokeWidth={3} /></button>
                                                                        </div>
                                                                        <span className="text-[12px] font-black text-gray-900 dark:text-white">₱{(item.product.price * item.qty).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleRemoveProduct(item.product.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0"><Trash2 size={16} /></button>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                                <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 space-y-4">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Total Amount</span>
                                                        <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">₱{selectedProducts.reduce((s, i) => s + (i.product.price * i.qty), 0).toLocaleString()}</span>
                                                    </div>
                                                    <button onClick={handleProceedToAssign} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-500/30 flex justify-center items-center hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale uppercase tracking-widest text-sm" disabled={selectedProducts.length === 0 || !selectedCustomer}>Review & Confirm <ArrowIcon size={20} className="ml-2" /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900 overflow-hidden animate-in fade-in duration-300">
                                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                                            <div className="text-left">
                                                <h4 className="font-black text-gray-800 dark:text-white text-sm uppercase tracking-widest">Review Categories</h4>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase">Assign items to specific debt groups</p>
                                            </div>
                                            <button onClick={() => setAddDebtStep('select')} className="text-xs text-blue-600 font-black flex items-center hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-full transition-colors"><ChevronLeft size={16} className="mr-1" /> BACK TO STORE</button>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-left">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedProducts.map(item => (
                                                    <div key={item.product.id} className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-3xl border-2 border-gray-100 dark:border-gray-700 transition-all hover:border-blue-400">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white shrink-0 shadow-md border border-gray-100"><img src={item.product.imageUrl} className="w-full h-full object-cover" alt="" /></div>
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="font-black text-gray-900 dark:text-white text-sm truncate leading-tight">{item.product.name}</h4>
                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full uppercase">QTY: {item.qty}</span>
                                                                    <span className="text-sm font-black text-red-600">₱{(item.product.price * item.qty).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Debt Category / Group</label>
                                                            <input type="text" list="category-suggestions" className="w-full text-sm p-3.5 bg-white dark:bg-gray-700 rounded-2xl border-2 border-gray-100 dark:border-gray-600 font-bold text-blue-600 outline-none focus:border-blue-500 shadow-sm" placeholder="e.g. Rice Loan, Grocery..." value={debtAssignments[item.product.id] || ''} onChange={(e) => setDebtAssignments({ ...debtAssignments, [item.product.id]: e.target.value })} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                                            <div className="max-w-4xl mx-auto">
                                                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                                                    <div className="text-center sm:text-left">
                                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Charging Account</p>
                                                        <p className="font-black text-blue-600 text-2xl leading-none">{MockService.getCustomers().find(c => c.id === selectedCustomer)?.name}</p>
                                                    </div>
                                                    <div className="text-center sm:text-right">
                                                        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Grand Total Debt</p>
                                                        <p className="font-black text-red-600 text-4xl tracking-tighter leading-none">₱{selectedProducts.reduce((s, i) => s + (i.product.price * i.qty), 0).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <button onClick={submitDebt} className="w-full bg-red-600 text-white py-5 rounded-3xl font-black shadow-2xl shadow-red-500/30 flex justify-center items-center hover:bg-red-700 transition-all active:scale-[0.98] uppercase tracking-widest text-lg">CONFIRM & RECORD DEBT <Check size={24} className="ml-2" strokeWidth={4} /></button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="space-y-6 p-8 max-w-lg mx-auto animate-in fade-in duration-300 text-left">
                                    <div className="space-y-5">
                                        <div>
                                            <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Select Customer</label>
                                            <select className="w-full p-4 border-2 border-gray-100 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 font-bold text-gray-800 dark:text-white outline-none focus:border-blue-500 shadow-sm" value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)}><option value="">-- Choose Account --</option>{MockService.getCustomers().map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}</select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Debt Amount</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400">₱</span>
                                                    <input type="number" className="w-full pl-9 p-4 border-2 border-gray-100 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 font-black text-2xl text-red-600 outline-none focus:border-red-500 shadow-sm" placeholder="0.00" value={manualForm.amount} onChange={e => setManualForm({ ...manualForm, amount: e.target.value })} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Category</label>
                                                <input type="text" list="category-suggestions" className="w-full p-4 border-2 border-gray-100 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-800 font-bold text-blue-600 outline-none focus:border-blue-500 shadow-sm" placeholder="General" value={manualForm.category} onChange={e => setManualForm({ ...manualForm, category: e.target.value })} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Transaction Timestamp</label>
                                            <input type="datetime-local" className="w-full p-4 border-2 border-gray-100 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 font-bold text-gray-700 dark:text-white outline-none focus:border-blue-500 shadow-sm" value={debtDate} onChange={e => setDebtDate(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-black text-gray-500 uppercase tracking-widest mb-2 ml-1">Internal Notes (Optional)</label>
                                            <textarea className="w-full p-4 border-2 border-gray-100 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 font-medium text-gray-700 dark:text-white outline-none focus:border-blue-500 shadow-sm h-28 resize-none" placeholder="Add specific details or items..." value={manualForm.description} onChange={e => setManualForm({ ...manualForm, description: e.target.value })}></textarea>
                                        </div>
                                    </div>
                                    <button onClick={submitDebt} disabled={!selectedCustomer || !manualForm.amount} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black shadow-2xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50 uppercase tracking-widest text-lg">Record Transaction</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SOA REPORT MODAL */}
            {showReportModal && reportData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                            <div>
                                <h3 className="font-black uppercase tracking-widest text-sm text-gray-800 dark:text-white">Statement of Account</h3>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Period Snapshot: {new Date(reportData.date).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 transition-colors"><X size={20} /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-8 bg-white text-gray-900 printable-content">
                             <div className="text-center mb-8 pb-8 border-b-2 border-dashed border-gray-200">
                                 <h1 className="text-2xl font-black uppercase tracking-tighter mb-1">LEDGER CONNECT</h1>
                                 <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Digital Merchant Ledger • Official SOA</p>
                             </div>

                             <div className="grid grid-cols-2 gap-8 mb-8">
                                 <div>
                                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Bill To:</p>
                                     <p className="font-black text-xl leading-none mb-1">{reportData.customer.name}</p>
                                     <p className="text-sm font-bold text-gray-500">{reportData.customer.phone}</p>
                                     <p className="text-xs text-gray-400 mt-1">{reportData.customer.address}</p>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Due:</p>
                                     <p className="font-black text-3xl text-red-600 leading-none">₱{reportData.grandTotal.toLocaleString()}</p>
                                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">Date: {new Date().toLocaleDateString()}</p>
                                 </div>
                             </div>

                             <div className="space-y-8">
                                 {reportData.categories.map(cat => (
                                     <div key={cat.name} className="space-y-3">
                                         <div className="flex justify-between items-end border-b-2 border-gray-900 pb-1">
                                             <h4 className="font-black uppercase tracking-widest text-sm">{cat.name}</h4>
                                             <p className="text-xs font-bold text-gray-400">Balance Group</p>
                                         </div>
                                         <table className="w-full text-sm">
                                             <tbody className="divide-y border-b">
                                                 <tr className="bg-gray-50 italic">
                                                     <td className="py-2 pl-2">Balance Forward</td>
                                                     <td className="py-2 text-right pr-2 font-bold font-mono">₱{cat.opening.toLocaleString()}</td>
                                                 </tr>
                                                 {cat.debts.map((d: any) => (
                                                     <tr key={d.id}>
                                                         <td className="py-2 pl-2">
                                                             <div className="font-bold">{d.items && d.items.length > 0 ? d.items[0].productName + (d.items.length > 1 ? ` +${d.items.length-1}` : '') : (d.notes || 'Added Debt')}</div>
                                                             <div className="text-[10px] text-gray-400 uppercase font-bold">{new Date(d.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                                         </td>
                                                         <td className="py-2 text-right pr-2 font-bold font-mono text-red-600">+₱{d.amount.toLocaleString()}</td>
                                                     </tr>
                                                 ))}
                                                 {cat.payments.map((p: any) => (
                                                     <tr key={p.id}>
                                                         <td className="py-2 pl-2">
                                                             <div className="font-bold">Payment Received</div>
                                                             <div className="text-[10px] text-gray-400 uppercase font-bold">{new Date(p.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                                         </td>
                                                         <td className="py-2 text-right pr-2 font-bold font-mono text-green-600">-₱{p.amount.toLocaleString()}</td>
                                                     </tr>
                                                 ))}
                                             </tbody>
                                             <tfoot>
                                                 <tr className="font-black bg-gray-100">
                                                     <td className="py-2 pl-2 uppercase text-[10px] tracking-widest">Group Balance</td>
                                                     <td className="py-2 text-right pr-2 font-mono">₱{cat.closing.toLocaleString()}</td>
                                                 </tr>
                                             </tfoot>
                                         </table>
                                     </div>
                                 ))}
                             </div>

                             <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-200 text-center">
                                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2">Thank you for your business</p>
                                 <p className="text-xs text-gray-300 font-mono">Generated via Ledger Connect v1.0.0 • {new Date().toISOString()}</p>
                             </div>
                        </div>

                        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex gap-2 no-print">
                             <button onClick={() => window.print()} className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"><Printer size={16} /> Print SOA</button>
                             <button onClick={() => setShowReportModal(false)} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center transition-colors hover:bg-blue-700">Done</button>
                        </div>
                    </div>
                </div>
            )}

            <datalist id="category-suggestions">{categorySuggestions.map(cat => (<option key={cat} value={cat} />))}</datalist>
            <NumpadModal 
                isOpen={showNumpad} 
                initialValue={numpadInitialValue} 
                title="Enter Quantity" 
                onClose={() => setShowNumpad(false)} 
                onConfirm={(val) => { 
                    if (numpadTargetId) {
                        setSelectedProducts(selectedProducts.map(i => i.product.id === numpadTargetId ? { ...i, qty: val } : i));
                    }
                }} 
            />
        </div>
    );
};

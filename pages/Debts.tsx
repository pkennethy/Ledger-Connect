
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Plus, X, Wallet, Calendar, Phone, Printer, MessageSquare, Minus, Trash2, ChevronLeft, ChevronRight, ShoppingCart, List, ShieldAlert, Eye, EyeOff, Layers, ArrowUpRight, ArrowDownLeft, PackageSearch, ClipboardList, CheckCircle, Filter, LayoutGrid, LayoutList, Grab, RefreshCw, Lock, Tag, AlertCircle, FileEdit, Edit3, Coins, PlusCircle } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, DebtStatus, Customer, Product, User, UserRole, OrderItem } from '../types';
import { useToast } from '../context/ToastContext';
import { NumpadModal } from '../components/NumpadModal';

interface PageProps {
    lang: Language;
    user: User;
}

type WorkspaceTab = 'CATALOG' | 'MANUAL' | 'QUEUE';
type CatalogView = 'GRID' | 'LIST';

export const Debts: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;
    const { showToast } = useToast();

    // --- UI HELPERS ---
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
    
    // Robust local date formatting
    const getLocalDateFromISO = (isoDate: string) => {
        const d = new Date(isoDate);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const getLocalToday = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    // --- MAIN VIEW STATE ---
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    // --- DETAIL VIEW STATE ---
    const [selectedDetailCustomer, setSelectedDetailCustomer] = useState<Customer | null>(null);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailFilterDate, setDetailFilterDate] = useState(getLocalToday());
    const [ledgerPage, setLedgerPage] = useState(1);
    const ledgerItemsPerPage = 10;

    // --- DRAG AND DROP STATE ---
    const [draggedTxn, setDraggedTxn] = useState<{id: string, type: 'DEBT' | 'PAYMENT', category: string} | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [activeDropTarget, setActiveDropTarget] = useState<string | null>(null);

    // --- MODAL STATES ---
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false); 
    const [modalStep, setModalStep] = useState<'SELECT_CUSTOMER' | 'WORKSPACE'>('SELECT_CUSTOMER');
    const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('CATALOG');
    const [catalogView, setCatalogView] = useState<CatalogView>('GRID');
    
    const [modalProdPage, setModalProdPage] = useState(1);
    const modalProdItemsPerPage = 20; 
    const [modalCustPage, setModalCustPage] = useState(1);
    const modalCustItemsPerPage = 12;
    const [modalQueuePage, setModalQueuePage] = useState(1);
    const modalQueueItemsPerPage = 5;
    const [showRepayModal, setShowRepayModal] = useState(false);
    const [repayCustomer, setRepayCustomer] = useState<string>('');
    const [repayAmount, setRepayAmount] = useState<string>('');
    const [repayCategory, setRepayCategory] = useState<string>('');
    const [viewingTxnItems, setViewingTxnItems] = useState<any | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{id: string, type: 'DEBT' | 'PAYMENT'} | null>(null);
    const [deletePassInput, setDeletePassInput] = useState('');
    const [showDeletePass, setShowDeletePass] = useState(false);
    const [showNumpad, setShowNumpad] = useState(false);
    const [numpadTargetId, setNumpadTargetId] = useState<string | null>(null);
    const [numpadInitialValue, setNumpadInitialValue] = useState(1);
    const [refresh, setRefresh] = useState(0);

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedProducts, setSelectedProducts] = useState<Array<{product: Product, qty: number}>>([]);
    const [debtAssignments, setDebtAssignments] = useState<Record<string, string>>({}); 
    const [debtDate, setDebtDate] = useState('');
    const [shopSearch, setShopSearch] = useState('');
    const [shopCategory, setShopCategory] = useState('All');
    const [manualEntry, setManualEntry] = useState({ amount: '', category: 'Manual Entry', description: '' });

    // --- DATA PREPARATION ---
    const allDebts = useMemo(() => MockService.getDebts(), [refresh]);
    const allPayments = useMemo(() => MockService.getRepayments(), [refresh]);
    const categorySuggestions = useMemo(() => Array.from(new Set(allDebts.map(d => d.category))).sort(), [allDebts]);
    
    const customerActiveCategories = useMemo(() => {
        if (!selectedDetailCustomer) return [];
        const customerDebts = allDebts.filter(d => d.customerId === selectedDetailCustomer.id);
        const customerRepayments = allPayments.filter(p => p.customerId === selectedDetailCustomer.id);
        
        // Calculate balance per category
        const catMap: Record<string, number> = {};
        customerDebts.forEach(d => {
            catMap[d.category] = (catMap[d.category] || 0) + d.amount;
        });
        customerRepayments.forEach(p => {
            catMap[p.category] = (catMap[p.category] || 0) - p.amount;
        });

        // Only return categories with an outstanding balance (debt > 0)
        return Object.keys(catMap)
            .filter(cat => catMap[cat] > 0.01)
            .sort();
    }, [selectedDetailCustomer, allDebts, allPayments]);

    const liveCustomerBalance = useMemo(() => {
        if (!selectedDetailCustomer) return 0;
        const debts = allDebts.filter(d => d.customerId === selectedDetailCustomer.id);
        const payments = allPayments.filter(p => p.customerId === selectedDetailCustomer.id);
        const totalD = debts.reduce((s, d) => s + d.amount, 0);
        const totalP = payments.reduce((s, p) => s + p.amount, 0);
        return Math.max(0, totalD - totalP);
    }, [selectedDetailCustomer, allDebts, allPayments, refresh]);

    const customerBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        MockService.getCustomers().forEach(c => {
            const debts = allDebts.filter(d => d.customerId === c.id);
            const payments = allPayments.filter(p => p.customerId === c.id);
            const totalD = debts.reduce((s, d) => s + d.amount, 0);
            const totalP = payments.reduce((s, p) => s + p.amount, 0);
            balances[c.id] = Math.max(0, totalD - totalP);
        });
        return balances;
    }, [allDebts, allPayments, refresh]);

    const availableRepayCategories = useMemo(() => {
        if (!repayCustomer) return [];
        return Array.from(new Set(allDebts.filter(d => d.customerId === repayCustomer && (d.amount - d.paidAmount) >= 0.01).map(d => d.category))).sort();
    }, [repayCustomer, allDebts]);

    const filteredCustomers = useMemo(() => {
        let list = MockService.getCustomers().filter(c => c.role !== UserRole.ADMIN);
        if (!isAdmin) list = list.filter(c => c.id === user.id);
        else {
            if (searchTerm) list = list.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm));
        }
        return list.sort((a, b) => (customerBalances[b.id] || 0) - (customerBalances[a.id] || 0));
    }, [searchTerm, isAdmin, user.id, customerBalances]);

    const paginatedCustomers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredCustomers.slice(start, start + itemsPerPage);
    }, [filteredCustomers, currentPage]);

    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const allProducts = useMemo(() => MockService.getProducts(), [refresh]);
    const filteredProducts = useMemo(() => {
        return allProducts.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(shopSearch.toLowerCase());
            const matchesCategory = shopCategory === 'All' || p.category === shopCategory;
            return matchesSearch && matchesCategory;
        });
    }, [allProducts, shopSearch, shopCategory]);

    const totalModalProdPages = Math.ceil(filteredProducts.length / modalProdItemsPerPage);
    const productCategories = useMemo(() => ['All', ...Array.from(new Set(allProducts.map(p => p.category))).sort()], [allProducts]);

    useEffect(() => {
        if (showAddModal) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            setDebtDate(now.toISOString().slice(0, 16));
            setModalCustPage(1);
            setModalProdPage(1);
            setModalQueuePage(1);
            setIsSubmitting(false);
        }
    }, [showAddModal]);

    // Reset date to "Today" whenever a customer detail is opened or changed
    useEffect(() => {
        if (selectedDetailCustomer) {
            setDetailFilterDate(getLocalToday());
            setDetailSearch('');
            setLedgerPage(1);
        }
    }, [selectedDetailCustomer]);

    // Handle pagination reset on filter change
    useEffect(() => { 
        setLedgerPage(1); 
    }, [detailFilterDate, detailSearch]);

    // --- DRAG HANDLERS ---
    const handleDragStart = (e: React.DragEvent, txn: any) => {
        e.dataTransfer.setData('text/plain', txn.id);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedTxn({ id: txn.id, type: txn.type, category: txn.category });
        setTimeout(() => { setIsDragging(true); }, 0);
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        setDraggedTxn(null);
        setActiveDropTarget(null);
    };

    const handleDrop = async (e: React.DragEvent, targetCategory: string) => {
        e.preventDefault();
        if (!draggedTxn) return;
        if (targetCategory === 'DELETE_ZONE') {
            setDeleteTarget({ id: draggedTxn.id, type: draggedTxn.type });
            setShowDeleteModal(true);
        } else if (targetCategory !== draggedTxn.category) {
            try {
                if (draggedTxn.type === 'DEBT') {
                    await MockService.updateDebtCategory(draggedTxn.id, targetCategory);
                } else {
                    await MockService.updateRepaymentCategory(draggedTxn.id, targetCategory);
                }
                showToast(`Moved to ${targetCategory}`, 'success');
                setRefresh(prev => prev + 1);
            } catch (err) {
                showToast('Update failed', 'error');
            }
        }
        handleDragEnd();
    };

    const handleDragOver = (e: React.DragEvent, target: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setActiveDropTarget(target);
    };

    // --- ACTIONS ---
    const handleOpenAdd = (cust?: Customer, tab: WorkspaceTab = 'CATALOG', prefillCategory?: string) => {
        if (cust) { 
            setSelectedCustomer(cust); 
            setModalStep('WORKSPACE'); 
            setWorkspaceTab(tab);
            if (tab === 'MANUAL' && prefillCategory) {
                setManualEntry(prev => ({ ...prev, category: prefillCategory }));
            }
        } 
        else { 
            setSelectedCustomer(null); 
            setModalStep('SELECT_CUSTOMER'); 
            setWorkspaceTab('CATALOG');
        }
        setShowAddModal(true);
    };

    const handleAddProduct = (pid: string) => {
        const p = allProducts.find(x => x.id === pid);
        if (!p || !selectedCustomer) return;
        const existing = selectedProducts.find(x => x.product.id === pid);
        if (existing) setSelectedProducts(selectedProducts.map(x => x.product.id === pid ? { ...x, qty: x.qty + 1 } : x));
        else {
            const lastCat = MockService.getLastUsedCategory(selectedCustomer.id, pid);
            setSelectedProducts([...selectedProducts, { product: p, qty: 1 }]);
            setDebtAssignments(prev => ({ ...prev, [pid]: lastCat || p.category }));
        }
        showToast(`Added ${p.name}`, 'info');
    };

    const handleUpdateQty = (pid: string, delta: number) => {
        setSelectedProducts(prev => prev.map(item => item.product.id === pid ? { ...item, qty: Math.max(1, item.qty + delta) } : item));
    };

    const submitDebt = async () => {
        if (!selectedCustomer || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const createdAt = debtDate ? new Date(debtDate).toISOString() : new Date().toISOString();
            const itemsByCat: Record<string, any[]> = {};
            selectedProducts.forEach(item => {
                const cat = debtAssignments[item.product.id] || item.product.category;
                if (!itemsByCat[cat]) itemsByCat[cat] = [];
                // CRITICAL FIX: use item.qty instead of item.quantity
                itemsByCat[cat].push({ 
                    productId: item.product.id, 
                    productName: item.product.name, 
                    quantity: item.qty, 
                    price: item.product.price, 
                    category: cat 
                });
            });

            for (const [cat, items] of Object.entries(itemsByCat)) {
                // Ensure quantity is correct in reduction
                const total = items.reduce((s, i) => s + (i.price * i.quantity), 0);
                if (isNaN(total)) throw new Error("Calculation error: Invalid amount.");
                
                await MockService.createDebt({ 
                    id: `d-p-${Date.now()}-${Math.random().toString(36).substr(2,5)}`, 
                    customerId: selectedCustomer.id, 
                    amount: total, 
                    paidAmount: 0, 
                    items, 
                    category: cat, 
                    createdAt, 
                    status: DebtStatus.UNPAID 
                });
            }

            if (manualEntry.amount) {
                const manualAmt = parseFloat(manualEntry.amount);
                if (isNaN(manualAmt)) throw new Error("Invalid manual entry amount.");
                
                await MockService.createDebt({ 
                    id: `d-m-${Date.now()}`, 
                    customerId: selectedCustomer.id, 
                    amount: manualAmt, 
                    paidAmount: 0, 
                    items: [], 
                    category: manualEntry.category || 'Manual Entry', 
                    createdAt, 
                    status: DebtStatus.UNPAID, 
                    notes: manualEntry.description 
                });
            }
            
            setShowAddModal(false); 
            setSelectedProducts([]); 
            setManualEntry({ amount: '', category: 'Manual Entry', description: '' }); 
            setRefresh(prev => prev + 1);
            showToast('Success', 'success');
        } catch (e: any) {
            console.error("Debt Submission Error:", e);
            showToast(e.message || 'Failed to save', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRepaySubmit = async () => {
        if (!repayCustomer || !repayAmount || !repayCategory || isSubmitting) return showToast('Fill all fields', 'error');
        setIsSubmitting(true);
        try {
            await MockService.repayDebtByCategory(repayCustomer, repayCategory, parseFloat(repayAmount));
            setShowRepayModal(false); setRepayAmount(''); setRefresh(prev => prev + 1);
            showToast('Payment Recorded', 'success');
        } catch (e) {
            showToast('Failed to process payment', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const currentAdmin = MockService.getCustomers().find(c => c.role === UserRole.ADMIN && c.phone === user.phone);
        const correctPassword = user.password || currentAdmin?.password;
        
        if (deletePassInput.trim() !== correctPassword) {
            showToast('Incorrect administrator password', 'error');
            return;
        }

        try {
            if (deleteTarget.type === 'DEBT') {
                await MockService.deleteDebt(deleteTarget.id);
            } else {
                await MockService.deleteRepayment(deleteTarget.id);
            }
            showToast('Transaction permanently removed', 'success'); 
            setRefresh(prev => prev + 1);
            setShowDeleteModal(false);
            setDeletePassInput('');
        } catch (err) {
            showToast('Deletion failed', 'error');
        }
    };

    const handleSendSMS = () => {
        if (!selectedDetailCustomer) return;
        const debts = MockService.getDebts(selectedDetailCustomer.id);
        const payments = MockService.getRepayments(selectedDetailCustomer.id);
        
        const allTxns = [
            ...debts.map(d => {
                let desc = 'Manual Entry';
                if (d.items && d.items.length > 0) {
                    desc = d.items.length === 1 ? d.items[0].productName : `${d.items[0].productName} +${d.items.length - 1}`;
                } else if (d.notes) {
                    desc = d.notes;
                }
                return { ...d, type: 'DEBT', date: d.createdAt, description: desc };
            }),
            ...payments.map(p => ({ ...p, type: 'PAYMENT', date: p.timestamp, description: `Repayment` }))
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const categorized: Record<string, any[]> = {};
        allTxns.forEach(txn => {
            if (!categorized[txn.category]) categorized[txn.category] = [];
            categorized[txn.category].push(txn);
        });
        
        let smsBody = `SOA: ${selectedDetailCustomer.name.toUpperCase()}\nDATE: ${new Date(detailFilterDate).toLocaleDateString()}\n`;
        let totalDue = 0;
        
        Object.keys(categorized).sort().forEach(cat => {
            const txns = categorized[cat];
            let catBalance = 0;
            const periodTxns = [];
            
            txns.forEach(t => {
                const dt = getLocalDateFromISO(t.date);
                if (dt < detailFilterDate) {
                    catBalance += (t.type === 'DEBT' ? t.amount : -t.amount);
                } else if (dt === detailFilterDate) {
                    periodTxns.push(t);
                }
            });
            
            if (periodTxns.length === 0 && catBalance === 0) return;
            
            smsBody += `\n[[${cat.toUpperCase()}]]\n`;
            smsBody += `PREV BAL: P${catBalance.toLocaleString()}\n`;
            
            periodTxns.forEach(txn => {
                const timeStr = new Date(txn.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const sign = txn.type === 'DEBT' ? '+' : '-';
                const displayDesc = txn.description;
                
                smsBody += `${timeStr} ${sign}P${txn.amount.toLocaleString()} (${displayDesc})\n`;
                
                if (txn.type === 'DEBT' && txn.items && txn.items.length > 0) {
                    txn.items.forEach((item: OrderItem) => { 
                        smsBody += `  - ${item.productName} x${item.quantity}\n`; 
                    });
                }
                
                catBalance += (txn.type === 'DEBT' ? txn.amount : -txn.amount);
            });
            
            smsBody += `CLOSING: P${catBalance.toLocaleString()}\n`;
            totalDue += catBalance;
        });
        
        smsBody += `\nTOTAL DUE: P${totalDue.toLocaleString()}`;
        window.location.href = `sms:${selectedDetailCustomer.phone}?body=${encodeURIComponent(smsBody)}`;
    };

    // --- LEDGER RENDERERS ---
    const renderLedger = (customerId: string) => {
        const debts = MockService.getDebts(customerId);
        const payments = MockService.getRepayments(customerId);
        const allTxns = [
            ...debts.map(d => ({ ...d, type: 'DEBT', id: d.id, category: d.category, createdAt: d.createdAt, amount: d.amount, items: d.items, notes: d.notes })),
            ...payments.map(p => ({ ...p, type: 'PAYMENT', id: p.id, category: p.category, createdAt: p.timestamp, amount: p.amount }))
        ].map(txn => {
            let desc = 'Repayment';
            if ((txn as any).type === 'DEBT') {
                if ((txn as any).items?.length > 0) {
                    desc = (txn as any).items.length === 1 ? (txn as any).items[0].productName : `${(txn as any).items[0].productName} +${(txn as any).items.length - 1}`;
                } else if ((txn as any).notes) {
                    desc = (txn as any).notes; 
                } else {
                    desc = 'Balance Adjustment';
                }
            }
            return { ...txn, date: txn.createdAt, description: desc };
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const categorized: Record<string, any[]> = {};
        allTxns.forEach(txn => {
            if (!categorized[txn.category]) categorized[txn.category] = [];
            categorized[txn.category].push(txn);
        });

        const categories = Object.keys(categorized).sort();
        if (categories.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-slate-600">
                    <PackageSearch size={48} className="opacity-10 mb-4" />
                    <p className="font-black uppercase tracking-widest text-sm text-center">No Data</p>
                </div>
            );
        }

        return categories.map(cat => {
            const txns = categorized[cat];
            let balance = 0;
            const periodTxns: any[] = [];
            txns.forEach(t => {
                const dt = getLocalDateFromISO(t.date);
                if (dt < detailFilterDate) {
                    balance += (t.type === 'DEBT' ? t.amount : -t.amount);
                } else if (dt === detailFilterDate) {
                    const matchesSearch = !detailSearch || 
                                          t.description.toLowerCase().includes(detailSearch.toLowerCase()) ||
                                          (t.notes && t.notes.toLowerCase().includes(detailSearch.toLowerCase()));
                    if (matchesSearch) periodTxns.push(t);
                }
            });
            const openingBalance = balance;
            if (periodTxns.length === 0 && !detailSearch && openingBalance === 0) return null;
            
            const paginatedLedger = periodTxns.slice((ledgerPage - 1) * ledgerItemsPerPage, ledgerPage * ledgerItemsPerPage);
            const totalLedgerPages = Math.ceil(periodTxns.length / ledgerItemsPerPage);

            return (
                <div key={cat} className="mb-10 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-xl dark:shadow-premium-dark overflow-hidden transition-all duration-300">
                    <div className="bg-blue-600 dark:bg-slate-800 px-6 py-4 flex justify-between items-center border-b dark:border-slate-700">
                        <div className="flex items-center gap-3">
                            <Layers className="text-blue-100 dark:text-blue-400" size={20} />
                            <h3 className="font-black text-white dark:text-slate-100 uppercase tracking-widest text-sm">{cat}</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            {isAdmin && (
                                <button 
                                    onClick={() => handleOpenAdd(selectedDetailCustomer!, 'MANUAL', cat)}
                                    className="no-print bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl transition-all flex items-center gap-2 group"
                                >
                                    <PlusCircle size={16} />
                                    <span className="text-[9px] font-black uppercase tracking-widest hidden group-hover:block">Direct Entry</span>
                                </button>
                            )}
                            <span className="text-[10px] font-black text-blue-100 dark:text-slate-400 uppercase tracking-widest">Ledger</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 dark:bg-slate-950 border-b dark:border-slate-800 text-[10px] font-black uppercase text-gray-400 dark:text-slate-500 tracking-widest">
                                    <th className="p-4 w-32">Time</th>
                                    <th className="p-4">Particulars</th>
                                    <th className="p-4 text-right">Debit (+)</th>
                                    <th className="p-4 text-right">Credit (-)</th>
                                    <th className="p-4 text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                <tr className="bg-blue-50/30 dark:bg-slate-800/20 italic text-gray-500 dark:text-slate-400">
                                    <td className="p-4 text-[10px]" colSpan={2}>Balance Forward</td>
                                    <td colSpan={2}></td>
                                    <td className="p-4 text-right font-bold font-mono">₱{openingBalance.toLocaleString()}</td>
                                </tr>
                                {paginatedLedger.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-xs text-gray-400 dark:text-slate-600 font-bold uppercase tracking-widest">No activity</td></tr>
                                ) : (
                                    paginatedLedger.map((txn, idx) => {
                                        const fullIndex = (ledgerPage - 1) * ledgerItemsPerPage + idx;
                                        let currentRunningBal = openingBalance;
                                        for(let i=0; i<=fullIndex; i++) {
                                            currentRunningBal += (periodTxns[i].type === 'DEBT' ? periodTxns[i].amount : -periodTxns[i].amount);
                                        }
                                        const isManualEntry = txn.type === 'DEBT' && (!txn.items || txn.items.length === 0);
                                        return (
                                            <tr 
                                                key={idx} 
                                                draggable={isAdmin}
                                                onDragStart={(e) => handleDragStart(e, txn)}
                                                onDragEnd={handleDragEnd}
                                                className={`relative group transition-all duration-200 hover:bg-blue-50 dark:hover:bg-slate-800/50 ${isAdmin ? 'cursor-grab active:cursor-grabbing' : ''} ${draggedTxn?.id === txn.id ? 'opacity-20 scale-95' : 'opacity-100'}`}
                                            >
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        {isAdmin && <Grab size={14} className="text-gray-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors" />}
                                                        <div className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">{new Date(txn.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            {isManualEntry && <Tag size={12} className="text-indigo-500 shrink-0" />}
                                                            <span className={`font-bold truncate max-w-[150px] ${isManualEntry ? 'text-indigo-900 dark:text-indigo-300' : 'text-gray-900 dark:text-slate-200'}`}>{txn.description}</span>
                                                            {txn.type === 'DEBT' && (txn as any).items?.length > 0 && (
                                                                <button onClick={() => setViewingTxnItems(txn)} className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors shrink-0"><List size={14}/></button>
                                                            )}
                                                        </div>
                                                        {txn.type === 'DEBT' && (txn as any).notes && (
                                                            <span className="text-[10px] italic text-gray-400 dark:text-slate-500 truncate max-w-[180px]">"{ (txn as any).notes }"</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-red-600 dark:text-rose-400 w-32">{txn.type === 'DEBT' ? `₱${txn.amount.toLocaleString()}` : '—'}</td>
                                                <td className="p-4 text-right font-mono font-bold text-green-600 dark:text-emerald-400 w-32">{txn.type === 'PAYMENT' ? `₱${txn.amount.toLocaleString()}` : '—'}</td>
                                                <td className="p-4 text-right font-mono font-black text-gray-900 dark:text-white w-32">₱{currentRunningBal.toLocaleString()}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            <tfoot className="bg-gray-50 dark:bg-slate-950 border-t dark:border-slate-800 font-black">
                                <tr>
                                    <td colSpan={4} className="p-4 text-right text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-widest">Closing for Date</td>
                                    <td className="p-4 text-right text-blue-600 dark:text-blue-400 text-lg">₱{(openingBalance + periodTxns.reduce((s,t) => s + (t.type === 'DEBT' ? t.amount : -t.amount), 0)).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    {totalLedgerPages > 1 && (
                        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex justify-between items-center no-print">
                            <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Page {ledgerPage}/{totalLedgerPages}</p>
                            <div className="flex gap-2">
                                <button disabled={ledgerPage === 1} onClick={() => setLedgerPage(p => p - 1)} className="p-2 border dark:border-slate-800 rounded-xl disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"><ChevronLeft size={16}/></button>
                                <button disabled={ledgerPage >= totalLedgerPages} onClick={() => setLedgerPage(p => p + 1)} className="p-2 border dark:border-slate-800 rounded-xl disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"><ChevronRight size={16}/></button>
                            </div>
                        </div>
                    )}
                </div>
            );
        });
    };

    return (
        <div className="space-y-6 relative min-h-full">
            {/* DRAG OVERLAY */}
            {isDragging && (
                <div className="fixed inset-0 z-[200] bg-blue-900/40 dark:bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-start pt-20 animate-in fade-in duration-300">
                    <div className="max-w-4xl w-full px-6 space-y-8 text-center">
                        <div className="space-y-2">
                            <h4 className="text-3xl font-black text-white uppercase tracking-tighter drop-shadow-xl">Drop to Reassign</h4>
                            <p className="text-sm font-bold text-blue-200 dark:text-slate-400 uppercase tracking-widest">Organize entries instantly</p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-8">
                            {customerActiveCategories.map(cat => (
                                <div 
                                    key={cat}
                                    onDragOver={(e) => handleDragOver(e, cat)}
                                    onDragLeave={() => setActiveDropTarget(null)}
                                    onDrop={(e) => handleDrop(e, cat)}
                                    className={`relative px-10 py-12 rounded-full border-4 transition-all duration-300 flex flex-col items-center justify-center gap-3 ${activeDropTarget === cat ? 'bg-blue-600 border-white text-white scale-125 shadow-[0_0_60px_rgba(37,99,235,0.6)]' : 'bg-white/10 dark:bg-slate-800/50 border-white/20 dark:border-slate-700 text-white shadow-2xl backdrop-blur-lg hover:bg-white/20'}`}
                                >
                                    <Layers size={activeDropTarget === cat ? 40 : 32} />
                                    <span className="text-xs font-black uppercase tracking-widest">{cat}</span>
                                    {activeDropTarget === cat && <div className="absolute inset-0 rounded-full animate-ping bg-blue-400/30" />}
                                </div>
                            ))}
                            <div 
                                onDragOver={(e) => handleDragOver(e, 'DELETE_ZONE')}
                                onDragLeave={() => setActiveDropTarget(null)}
                                onDrop={(e) => handleDrop(e, 'DELETE_ZONE')}
                                className={`relative px-10 py-12 rounded-full border-4 transition-all duration-300 flex flex-col items-center justify-center gap-3 ${activeDropTarget === 'DELETE_ZONE' ? 'bg-red-600 border-white text-white scale-125 shadow-[0_0_60px_rgba(220,38,38,0.6)]' : 'bg-red-50/20 dark:bg-rose-500/20 border-red-500/30 dark:border-rose-500/30 text-red-100 dark:text-rose-100 shadow-2xl backdrop-blur-lg'}`}
                            >
                                <Trash2 size={activeDropTarget === 'DELETE_ZONE' ? 40 : 32} />
                                <span className="text-xs font-black uppercase tracking-widest">Delete</span>
                                {activeDropTarget === 'DELETE_ZONE' && <div className="absolute inset-0 rounded-full animate-ping bg-red-400/30" />}
                            </div>
                        </div>
                        <div className="pt-10"><button onClick={handleDragEnd} className="px-8 py-3 bg-white/10 dark:bg-slate-800 text-white rounded-full font-black text-xs uppercase tracking-widest transition-all">Cancel</button></div>
                    </div>
                </div>
            )}

            {/* Main Header */}
            <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-slate-950/95 backdrop-blur-md -mx-4 px-4 pt-1 pb-4 border-b dark:border-slate-900 transition-colors duration-300">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center gap-3">
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white uppercase tracking-tight flex items-center gap-3 flex-wrap">
                            Ledger
                            <span className="text-[10px] bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full font-black tracking-widest shrink-0">{filteredCustomers.length} ACCOUNTS</span>
                        </h2>
                        <div className="flex items-center gap-2 shrink-0">
                             <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl shadow-sm border dark:border-slate-800 transition-all">
                                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 dark:text-slate-600'}`}><LayoutGrid size={18} /></button>
                                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 dark:text-slate-600'}`}><LayoutList size={18} /></button>
                            </div>
                        </div>
                    </div>
                    {isAdmin && (
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" size={18} />
                            <input type="text" placeholder="Search..." className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 outline-none shadow-sm dark:shadow-premium-dark font-bold focus:ring-2 focus:ring-blue-500 transition-all dark:text-slate-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    )}
                </div>
            </div>

            {/* List/Grid Displays */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {paginatedCustomers.map((c, idx) => {
                        const colors = ['from-pink-500 to-rose-600', 'from-blue-500 to-indigo-600', 'from-orange-400 to-orange-600', 'from-emerald-500 to-teal-600', 'from-purple-500 to-purple-700'];
                        const bal = customerBalances[c.id] || 0;
                        const colorClass = bal > 0 ? colors[idx % colors.length] : 'from-slate-400 to-slate-500';
                        return (
                            <div key={c.id} onClick={() => setSelectedDetailCustomer(c)} className={`relative aspect-[4/5] rounded-[2rem] p-6 shadow-xl dark:shadow-premium-dark flex flex-col justify-between overflow-hidden cursor-pointer hover:scale-[1.03] transition-all bg-gradient-to-br ${colorClass}`}>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 select-none"><span className="text-[10rem] font-black text-white">{getInitials(c.name)}</span></div>
                                <div className="relative z-10"><div className="bg-white/20 dark:bg-slate-900/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/30 inline-block">₱{bal.toLocaleString()}</div></div>
                                <div className="relative z-10"><h3 className="text-xl font-black text-white truncate leading-tight">{c.name}</h3><p className="text-[10px] text-white/70 font-bold uppercase mt-1 flex items-center gap-1"><Phone size={10} /> {c.phone}</p></div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="space-y-3">
                    {paginatedCustomers.map(c => {
                        const bal = customerBalances[c.id] || 0;
                        return (
                            <div key={c.id} onClick={() => setSelectedDetailCustomer(c)} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 flex justify-between items-center cursor-pointer hover:border-blue-500 group transition-all duration-300">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-lg">{getInitials(c.name)}</div>
                                    <div><h4 className="font-black text-gray-800 dark:text-slate-100 uppercase leading-none">{c.name}</h4><p className="text-[10px] text-gray-500 dark:text-slate-500 font-bold tracking-widest mt-1">{c.phone}</p></div>
                                </div>
                                <div className="text-right"><p className={`text-xl font-black font-mono ${bal > 0 ? 'text-red-600 dark:text-rose-400' : 'text-green-600 dark:text-emerald-400'}`}>₱{bal.toLocaleString()}</p></div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-colors duration-300">
                    <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border dark:border-slate-800 rounded-xl disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"><ChevronLeft size={18} /></button>
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border dark:border-slate-800 rounded-xl disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"><ChevronRight size={18} /></button>
                    </div>
                </div>
            )}

            {isAdmin && !selectedDetailCustomer && (
                <button onClick={() => handleOpenAdd()} className="fixed bottom-[140px] right-6 md:bottom-28 md:right-10 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"><Plus size={36} strokeWidth={3} /></button>
            )}

            {selectedDetailCustomer && (
                <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-slate-950 flex flex-col animate-in slide-in-from-right duration-300 transition-colors">
                    <div className="bg-white dark:bg-slate-900 p-6 border-b-2 dark:border-slate-800 shadow-sm shrink-0 transition-colors">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex gap-4 items-center">
                                <button onClick={() => { setSelectedDetailCustomer(null); }} className="p-2 -ml-2 text-gray-400 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white transition-colors"><ChevronLeft size={32}/></button>
                                <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center text-xl font-black shadow-lg">{getInitials(selectedDetailCustomer.name)}</div>
                                <div><h2 className="text-2xl font-black text-gray-900 dark:text-white leading-none uppercase tracking-tight">{selectedDetailCustomer.name}</h2><p className="text-xs text-gray-500 dark:text-slate-400 font-bold mt-1 tracking-widest">{selectedDetailCustomer.phone}</p></div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-1">Balance</p>
                                <p className="text-3xl font-black text-red-600 dark:text-rose-400 font-mono tracking-tighter">₱{liveCustomerBalance.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" /><input type="text" placeholder="Filter Ledger..." className="w-full pl-10 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 outline-none font-bold text-sm shadow-inner transition-all dark:text-slate-200" value={detailSearch} onChange={e => setDetailSearch(e.target.value)} /></div>
                            <div className="relative shrink-0"><Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 dark:text-blue-400" /><input type="date" className="pl-10 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 outline-none font-bold text-sm shadow-inner w-full md:w-48 transition-all dark:text-slate-200" value={detailFilterDate} onChange={e => setDetailFilterDate(e.target.value)} /></div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                                <button onClick={handleSendSMS} className="p-3.5 bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-600 dark:text-slate-300 border dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all shadow-sm"><MessageSquare size={18}/></button>
                                <button onClick={() => { setRepayCustomer(selectedDetailCustomer.id); setRepayCategory(''); setRepayAmount(''); setShowRepayModal(true); }} className="whitespace-nowrap bg-green-600 dark:bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-95 transition-all"><Wallet size={16}/> Pay</button>
                                <button onClick={() => handleOpenAdd(selectedDetailCustomer, 'MANUAL')} className="whitespace-nowrap bg-indigo-600 dark:bg-indigo-600 text-white px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"><Tag size={16}/> Manual</button>
                                <button onClick={() => handleOpenAdd(selectedDetailCustomer, 'CATALOG')} className="whitespace-nowrap bg-red-600 dark:bg-rose-600 text-white px-6 py-3.5 rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-95 transition-all"><Plus size={16}/> Credit</button>
                                <button onClick={() => window.print()} className="p-3.5 bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-600 dark:text-slate-300 border dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all shadow-sm"><Printer size={18}/></button>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 pb-[140px] bg-gray-50/50 dark:bg-slate-950 scroll-smooth transition-colors"><div className="max-w-6xl mx-auto printable-content">{renderLedger(selectedDetailCustomer.id)}</div></div>
                </div>
            )}

            {/* ADD TRANSACTION MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 dark:bg-slate-950/80 backdrop-blur-sm z-[110] flex items-center justify-center sm:p-4">
                    <div className="bg-white dark:bg-slate-900 sm:rounded-[2.5rem] shadow-2xl dark:shadow-premium-dark w-full max-w-7xl h-full sm:h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 transition-all">
                        <div className="px-6 py-4 border-b dark:border-slate-800 bg-blue-600 text-white flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <Edit3 size={20} strokeWidth={3} />
                                <h3 className="text-lg font-black uppercase tracking-tight">Record Transaction</h3>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24} /></button>
                        </div>
                        {modalStep === 'SELECT_CUSTOMER' ? (
                            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-950 overflow-hidden">
                                <div className="p-6 shrink-0 border-b dark:border-slate-800 bg-white dark:bg-slate-900">
                                    <h4 className="text-xl font-black text-gray-800 dark:text-white mb-4 uppercase tracking-widest text-center tracking-[0.2em]">Identify Customer</h4>
                                    <div className="relative max-w-2xl mx-auto w-full"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" /><input type="text" autoFocus placeholder="Search name or mobile..." className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-transparent focus:border-blue-500 bg-gray-100 dark:bg-slate-800 outline-none font-bold shadow-inner dark:text-slate-200 transition-all" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setModalCustPage(1); }} /></div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {filteredCustomers.slice((modalCustPage - 1) * modalCustItemsPerPage, modalCustPage * modalCustItemsPerPage).map(c => (
                                        <div key={c.id} onClick={() => { setSelectedCustomer(c); setModalStep('WORKSPACE'); }} className="aspect-[4/5] rounded-[2rem] p-6 shadow-lg dark:shadow-premium-dark bg-white dark:bg-slate-900 flex flex-col justify-between cursor-pointer hover:border-blue-500 border-4 border-transparent transition-all group">
                                            <div className="flex-1 flex items-center justify-center"><div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl font-black group-hover:scale-110 transition-transform">{getInitials(c.name)}</div></div>
                                            <div><h5 className="text-lg font-black text-gray-800 dark:text-slate-100 truncate text-center">{c.name}</h5><p className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest text-center mt-1">{c.phone}</p></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="flex bg-white dark:bg-slate-900 border-b dark:border-slate-800 shrink-0">
                                    <button onClick={() => setWorkspaceTab('CATALOG')} className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-4 ${workspaceTab === 'CATALOG' ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-500/5' : 'border-transparent text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}><PackageSearch size={18} />Catalog</button>
                                    <button onClick={() => setWorkspaceTab('MANUAL')} className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-4 ${workspaceTab === 'MANUAL' ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-500/5' : 'border-transparent text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}><FileEdit size={18} />Manual</button>
                                    <button onClick={() => setWorkspaceTab('QUEUE')} className={`flex-1 flex items-center justify-center gap-2 py-4 text-xs font-black uppercase tracking-widest transition-all border-b-4 relative ${workspaceTab === 'QUEUE' ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-500/5' : 'border-transparent text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800'}`}><ClipboardList size={18} />Queue{(selectedProducts.length > 0 || manualEntry.amount) && <span className="absolute top-2 right-4 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white shadow-sm">{selectedProducts.length + (manualEntry.amount ? 1 : 0)}</span>}</button>
                                </div>
                                <div className="flex-1 overflow-hidden flex flex-col bg-gray-50/30 dark:bg-slate-950/30">
                                    {workspaceTab === 'CATALOG' && (
                                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
                                            {/* CATEGORY SIDEBAR */}
                                            <div className="w-full lg:w-48 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r dark:border-slate-800 flex lg:flex-col overflow-x-auto lg:overflow-y-auto no-scrollbar p-2 gap-2 shrink-0">
                                                {productCategories.map(cat => (
                                                    <button 
                                                        key={cat} 
                                                        onClick={() => { setShopCategory(cat); setModalProdPage(1); }}
                                                        className={`flex-1 lg:flex-none px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-left transition-all whitespace-nowrap ${shopCategory === cat ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-100'}`}
                                                    >
                                                        {cat === 'All' ? 'Everything' : cat}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex-1 flex flex-col overflow-hidden">
                                                <div className="p-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center shadow-sm shrink-0">
                                                    <div className="flex items-center gap-3 shrink-0">
                                                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">{getInitials(selectedCustomer?.name || '??')}</div>
                                                        <div className="min-w-0"><h4 className="font-black text-gray-800 dark:text-slate-100 uppercase leading-none text-xs truncate">{selectedCustomer?.name}</h4><button onClick={() => setModalStep('SELECT_CUSTOMER')} className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mt-1 hover:underline">Change Account</button></div>
                                                    </div>
                                                    <div className="flex-1 flex gap-2 w-full">
                                                        <div className="flex-1 relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" /><input type="text" placeholder="Search product catalog..." className="w-full pl-9 pr-4 py-2.5 bg-gray-100 dark:bg-slate-800 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none border-none shadow-inner dark:text-slate-200 transition-all" value={shopSearch} onChange={e => { setShopSearch(e.target.value); setModalProdPage(1); }} /></div>
                                                        <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner border dark:border-slate-700 transition-all">
                                                            <button onClick={() => setCatalogView('GRID')} className={`p-2 rounded-lg transition-colors ${catalogView === 'GRID' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-gray-400 dark:text-slate-600'}`}><LayoutGrid size={16} /></button>
                                                            <button onClick={() => setCatalogView('LIST')} className={`p-2 rounded-lg transition-colors ${catalogView === 'LIST' ? 'bg-white dark:bg-slate-700 shadow text-blue-600' : 'text-gray-400 dark:text-slate-600'}`}><LayoutList size={16} /></button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1 overflow-y-auto p-4 md:p-6 scrollbar-hide">
                                                    {catalogView === 'GRID' ? (
                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                                                            {filteredProducts.slice((modalProdPage-1)*modalProdItemsPerPage, modalProdPage*modalProdItemsPerPage).map(product => {
                                                                const inCart = selectedProducts.find(p => p.product.id === product.id);
                                                                return (
                                                                    <div key={product.id} onClick={() => handleAddProduct(product.id)} className={`relative bg-white dark:bg-slate-900 rounded-2xl shadow-sm dark:shadow-premium-dark border overflow-hidden flex flex-col group transition-all hover:shadow-xl hover:-translate-y-1 active:scale-95 ${inCart ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-100 dark:border-slate-800'}`}>
                                                                        <div className="aspect-square relative overflow-hidden">
                                                                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                                            {inCart && <div className="absolute inset-0 bg-blue-600/10 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in duration-200"><div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-lg border-2 border-white shadow-lg">{inCart.qty}</div></div>}
                                                                            <div className="absolute top-2 left-2 flex flex-col gap-1">
                                                                                <div className={`px-2 py-0.5 rounded-full text-[8px] font-black text-white uppercase tracking-tighter ${product.stock <= 5 ? 'bg-red-600' : 'bg-green-600/80'}`}>Stock: {product.stock}</div>
                                                                            </div>
                                                                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent"><p className="text-white font-black text-xs">₱{product.price.toLocaleString()}</p></div>
                                                                        </div>
                                                                        <div className="p-3 flex-1 flex flex-col">
                                                                            <h4 className="font-bold text-gray-900 dark:text-slate-200 text-[11px] line-clamp-2 leading-tight h-8 mb-1 uppercase">{product.name}</h4>
                                                                            <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">{product.category}</p>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {filteredProducts.slice((modalProdPage-1)*modalProdItemsPerPage, modalProdPage*modalProdItemsPerPage).map(product => {
                                                                const inCart = selectedProducts.find(p => p.product.id === product.id);
                                                                return (
                                                                    <div key={product.id} onClick={() => handleAddProduct(product.id)} className={`flex items-center gap-4 p-3 bg-white dark:bg-slate-900 rounded-xl border transition-all cursor-pointer hover:border-blue-500 ${inCart ? 'border-blue-500 bg-blue-50/20' : 'border-gray-100 dark:border-slate-800'}`}>
                                                                        <img src={product.imageUrl} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />
                                                                        <div className="flex-1 min-w-0">
                                                                            <h4 className="font-bold text-gray-900 dark:text-slate-200 text-xs truncate uppercase tracking-tight">{product.name}</h4>
                                                                            <div className="flex items-center gap-2 mt-1">
                                                                                <span className="text-[10px] font-black text-blue-600">₱{product.price.toLocaleString()}</span>
                                                                                <span className={`text-[9px] font-bold uppercase ${product.stock <= 5 ? 'text-red-500' : 'text-gray-400'}`}>• Stock: {product.stock}</span>
                                                                            </div>
                                                                        </div>
                                                                        {inCart ? (
                                                                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-xs shadow-md">x{inCart.qty}</div>
                                                                        ) : (
                                                                            <div className="p-2 text-gray-300 group-hover:text-blue-500"><Plus size={18} /></div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}

                                                    {filteredProducts.length === 0 && (
                                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                                            <PackageSearch size={48} className="opacity-10 mb-4" />
                                                            <p className="font-black uppercase tracking-widest text-xs">No catalog matches</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {workspaceTab === 'MANUAL' && (
                                        <div className="flex-1 flex flex-col p-6 space-y-6 animate-in fade-in zoom-in-95 duration-300 overflow-y-auto">
                                             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border dark:border-slate-800 space-y-8 max-w-2xl mx-auto w-full">
                                                <div className="flex items-center gap-4 border-b dark:border-slate-800 pb-4">
                                                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400"><Tag size={24}/></div>
                                                    <div>
                                                        <h4 className="font-black uppercase tracking-tight text-gray-800 dark:text-slate-100">Direct Entry</h4>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adjust balance for {selectedCustomer?.name}</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Debit Amount (₱)</label>
                                                        <div className="relative">
                                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-4xl font-black text-blue-600 dark:text-blue-500">₱</span>
                                                            <input type="number" autoFocus className="w-full pl-14 pr-6 py-8 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 rounded-3xl outline-none font-black text-5xl transition-all dark:text-white font-mono" placeholder="0.00" value={manualEntry.amount} onChange={e => setManualEntry({...manualEntry, amount: e.target.value})} />
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Ledger Category</label>
                                                            <input type="text" list="ledger-cats-direct" className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-black text-blue-600 dark:text-blue-400 transition-all uppercase tracking-widest text-xs shadow-inner" placeholder="e.g. SERVICE FEE" value={manualEntry.category} onChange={e => setManualEntry({...manualEntry, category: e.target.value})} />
                                                            <datalist id="ledger-cats-direct">{categorySuggestions.map(cat => <option key={cat} value={cat} />)}</datalist>
                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                {['SERVICE', 'MISC', 'ADJUSTMENT'].map(tag => (
                                                                    <button key={tag} onClick={() => setManualEntry({...manualEntry, category: tag})} className="px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded-lg text-[9px] font-black text-gray-400 hover:text-blue-600 transition-colors uppercase">{tag}</button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Date (Optional)</label>
                                                            <input type="datetime-local" className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-black dark:text-slate-200 transition-all text-xs shadow-inner" value={debtDate} onChange={e => setDebtDate(e.target.value)} />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Public Remark / Note</label>
                                                        <textarea rows={2} className="w-full p-4 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-blue-500 rounded-2xl outline-none font-bold dark:text-slate-200 transition-all text-sm shadow-inner" placeholder="Reason for this manual charge..." value={manualEntry.description} onChange={e => setManualEntry({...manualEntry, description: e.target.value})} />
                                                    </div>
                                                </div>

                                                <div className="flex gap-4">
                                                    <button onClick={() => setWorkspaceTab('QUEUE')} className="flex-1 py-5 bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-[2rem] font-black uppercase tracking-widest text-[11px] hover:bg-gray-200 active:scale-95 transition-all">Move to Queue</button>
                                                    <button onClick={submitDebt} disabled={!manualEntry.amount || isSubmitting} className="flex-[2] py-5 bg-blue-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[11px] shadow-xl shadow-blue-500/20 active:scale-95 disabled:grayscale transition-all flex items-center justify-center gap-3">
                                                        {isSubmitting ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle size={18} />}
                                                        {isSubmitting ? 'Processing' : 'Commit Now'}
                                                    </button>
                                                </div>
                                             </div>
                                        </div>
                                    )}
                                    {workspaceTab === 'QUEUE' && (
                                        <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-2 duration-300">
                                            <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                                                {selectedProducts.length === 0 && !manualEntry.amount && (
                                                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                                        <ShoppingCart size={64} className="opacity-10 mb-4" />
                                                        <p className="font-black uppercase tracking-widest text-sm">Draft is empty</p>
                                                        <p className="text-[10px] font-bold mt-1 text-center">Add items from Catalog or Manual tabs</p>
                                                    </div>
                                                )}
                                                
                                                {manualEntry.amount && (
                                                    <div className="bg-indigo-50/50 dark:bg-indigo-500/5 p-5 rounded-3xl border-2 border-indigo-200 dark:border-indigo-500/20 relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 p-3 text-indigo-200 dark:text-indigo-500/20"><Tag size={48}/></div>
                                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                                            <div>
                                                                <span className="px-2 py-1 bg-indigo-600 text-white text-[8px] font-black rounded uppercase tracking-widest">Manual Charge</span>
                                                                <h6 className="font-black text-lg text-indigo-900 dark:text-indigo-300 mt-1 uppercase">{manualEntry.category}</h6>
                                                            </div>
                                                            <button onClick={() => setManualEntry({amount: '', category: 'Manual Entry', description: ''})} className="p-2 text-indigo-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                                                        </div>
                                                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold mb-4 line-clamp-2">"{manualEntry.description || 'No notes provided'}"</p>
                                                        <div className="text-right"><p className="text-3xl font-black text-indigo-900 dark:text-white font-mono">₱{parseFloat(manualEntry.amount).toLocaleString()}</p></div>
                                                    </div>
                                                )}

                                                {selectedProducts.slice((modalQueuePage - 1) * modalQueueItemsPerPage, modalQueuePage * modalQueueItemsPerPage).map(item => (
                                                    <div key={item.product.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border dark:border-slate-800 group transition-all hover:border-blue-500 shadow-sm dark:shadow-premium-dark relative overflow-hidden">
                                                        <div className="flex gap-4"><div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 dark:bg-slate-800 shrink-0 shadow-inner"><img src={item.product.imageUrl} className="w-full h-full object-cover" alt="" /></div><div className="flex-1 min-w-0"><div className="flex justify-between items-start"><h6 className="font-black text-sm text-gray-800 dark:text-slate-100 truncate uppercase">{item.product.name}</h6><button onClick={() => setSelectedProducts(selectedProducts.filter(p=>p.product.id !== item.product.id))} className="p-1 text-gray-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-rose-500 hover:bg-red-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"><Trash2 size={16}/></button></div><div className="flex items-center justify-between mt-3"><div className="flex items-center bg-gray-100 dark:bg-slate-800 rounded-xl p-1"><button onClick={() => handleUpdateQty(item.product.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-red-500 shadow-sm transition-all"><Minus size={14}/></button><button onClick={() => { setNumpadTargetId(item.product.id); setNumpadInitialValue(item.qty); setShowNumpad(true); }} className="w-10 font-black text-blue-600 dark:text-blue-400 text-sm text-center">{item.qty}</button><button onClick={() => handleUpdateQty(item.product.id, 1)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-green-500 shadow-sm transition-all"><Plus size={14}/></button></div><div className="text-right"><p className="font-black text-base text-gray-900 dark:text-white font-mono">₱{(item.product.price * item.qty).toLocaleString()}</p></div></div></div></div>
                                                        <div className="pt-3 border-t dark:border-slate-800 mt-4 flex items-center gap-3"><span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Assign to Ledger:</span><input type="text" list="ledger-cats-ws" className="flex-1 bg-gray-50 dark:bg-slate-950 dark:text-blue-400 border-none px-3 py-1.5 rounded-lg text-[11px] font-black text-blue-600 focus:ring-1 focus:ring-blue-500 outline-none transition-all" value={debtAssignments[item.product.id] || ''} onChange={e=>setDebtAssignments({...debtAssignments, [item.product.id]: e.target.value})} placeholder="e.g. Grocery Debt" /></div>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="p-8 bg-white dark:bg-slate-900 border-t-4 border-gray-50 dark:border-slate-950 space-y-6 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] dark:shadow-premium-dark"><div className="flex justify-between items-center"><div><span className="text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-[0.2em]">Summary Total</span></div><span className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter font-mono">₱{(selectedProducts.reduce((s, i) => s + (i.product.price * i.qty), 0) + (parseFloat(manualEntry.amount) || 0)).toLocaleString()}</span></div><button onClick={submitDebt} disabled={isSubmitting || ((selectedProducts.length === 0 && !manualEntry.amount) || !selectedCustomer)} className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-95 disabled:grayscale disabled:opacity-30 flex items-center justify-center gap-3">{isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle size={20} />}{isSubmitting ? 'Finalizing...' : 'Commit to Ledger'}</button></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* REPAYMENT MODAL */}
            {showRepayModal && (
                <div className="fixed inset-0 bg-black/60 dark:bg-slate-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="bg-green-600 p-6 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <Coins size={20} />
                                <h3 className="font-black uppercase tracking-tight text-sm">Collect Payment</h3>
                            </div>
                            <button onClick={() => setShowRepayModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Collection Amount (₱)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-black text-green-600">₱</span>
                                    <input type="number" autoFocus className="w-full pl-12 pr-4 py-6 bg-gray-50 dark:bg-slate-950 border-2 border-transparent focus:border-green-600 rounded-3xl outline-none font-black text-3xl transition-all dark:text-white font-mono" placeholder="0.00" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Settle Debt Category</label>
                                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                                    {availableRepayCategories.length > 0 ? (
                                        availableRepayCategories.map(cat => (
                                            <button key={cat} onClick={() => setRepayCategory(cat)} className={`p-4 rounded-2xl border-2 text-left transition-all ${repayCategory === cat ? 'border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold shadow-md' : 'border-gray-100 dark:border-slate-800 text-gray-600 dark:text-slate-400'}`}>
                                                <div className="flex justify-between items-center">
                                                    <span className="uppercase text-xs tracking-wider font-black">{cat}</span>
                                                    {repayCategory === cat && <CheckCircle size={16} />}
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-6 bg-gray-50 dark:bg-slate-800/50 rounded-2xl text-center border-2 border-dashed border-gray-200 dark:border-slate-700">
                                            <p className="text-xs text-gray-500 font-bold italic">No outstanding ledger groups.</p>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-4">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Unlisted Group (Bulk)</p>
                                    <input type="text" className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-950 border dark:border-slate-800 rounded-xl outline-none text-xs font-bold text-blue-600 focus:ring-2 focus:ring-blue-500 transition-all" placeholder="e.g. CROP SEASON" value={repayCategory} onChange={e => setRepayCategory(e.target.value)} />
                                </div>
                            </div>
                            <button onClick={handleRepaySubmit} disabled={isSubmitting || !repayAmount || !repayCategory} className="w-full bg-green-600 text-white py-5 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-green-500/20 active:scale-95 disabled:grayscale disabled:opacity-30 flex items-center justify-center gap-3 transition-all">
                                {isSubmitting ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                {isSubmitting ? 'Synchronizing' : 'Finalize Collection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-red-100 dark:border-red-900/30 animate-in zoom-in-95 duration-200">
                        <div className="bg-red-600 p-8 text-center text-white relative">
                            <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4"><ShieldAlert size={36} /></div>
                            <h3 className="text-xl font-black uppercase tracking-tight">Security Protocol</h3>
                            <p className="text-red-100 mt-2 text-xs font-bold uppercase tracking-widest opacity-90">Permanent Removal</p>
                        </div>
                        <div className="p-8">
                            <div className="bg-red-50 dark:bg-red-500/5 p-5 rounded-[1.5rem] border border-red-100 dark:border-red-500/20 mb-6">
                                <p className="text-xs text-red-600 dark:text-red-400 font-bold leading-relaxed text-center">Removing this entry will immediately adjust the customer's outstanding balance. Proceed with caution.</p>
                            </div>
                            <div className="space-y-4">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Administrator PIN/Passphrase</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input type={showDeletePass ? 'text' : 'password'} autoFocus className="w-full pl-12 pr-12 py-4 bg-gray-100 dark:bg-slate-950 border-2 border-transparent focus:border-red-600 rounded-2xl outline-none font-bold transition-all text-center tracking-widest" placeholder="••••••••" value={deletePassInput} onChange={e => setDeletePassInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmDelete()} />
                                    <button onClick={() => setShowDeletePass(!showDeletePass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 transition-colors">{showDeletePass ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                                </div>
                                <div className="flex gap-3 pt-4">
                                    <button onClick={() => { setShowDeleteModal(false); setDeletePassInput(''); }} className="flex-1 py-4 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all">Cancel</button>
                                    <button onClick={confirmDelete} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-600/20 active:scale-95 transition-all">Delete Entry</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TRANSACTION ITEMS MODAL */}
            {viewingTxnItems && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                            <div className="flex items-center gap-3"><List size={20} /><h3 className="font-black uppercase tracking-tight text-sm">Detailed Records</h3></div>
                            <button onClick={() => setViewingTxnItems(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
                        </div>
                        <div className="p-8">
                            <div className="mb-8 space-y-1">
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Entry Date</p>
                                <p className="font-black text-lg text-gray-800 dark:text-white uppercase">{new Date(viewingTxnItems.date).toLocaleString()}</p>
                            </div>
                            <div className="border dark:border-slate-800 rounded-[1.5rem] overflow-hidden mb-8 shadow-inner">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-50 dark:bg-slate-950 border-b dark:border-slate-800"><tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest"><th className="p-4">Particular</th><th className="p-4 text-center">Qty</th><th className="p-4 text-right">Price</th><th className="p-4 text-right">Total</th></tr></thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {viewingTxnItems.items.map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="p-4 font-bold text-gray-800 dark:text-slate-200 uppercase">{item.productName}</td>
                                                <td className="p-4 text-center font-mono font-bold text-blue-600">x{item.quantity}</td>
                                                <td className="p-4 text-right font-mono text-gray-500">P{item.price.toLocaleString()}</td>
                                                <td className="p-4 text-right font-black text-gray-900 dark:text-white">P{(item.price * item.quantity).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-blue-50/30 dark:bg-blue-900/10 border-t dark:border-slate-800"><tr className="font-black"><td colSpan={3} className="p-4 text-right text-[10px] text-gray-400 uppercase tracking-widest">Transaction Total</td><td className="p-4 text-right text-blue-600 dark:text-blue-400 text-lg font-mono">P{viewingTxnItems.amount.toLocaleString()}</td></tr></tfoot>
                                </table>
                            </div>
                            <button onClick={() => setViewingTxnItems(null)} className="w-full py-5 bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-gray-200 transition-all">Dismiss Record</button>
                        </div>
                    </div>
                </div>
            )}

            <NumpadModal isOpen={showNumpad} initialValue={numpadInitialValue} title="Enter Quantity" onClose={() => setShowNumpad(false)} onConfirm={(val) => { if (numpadTargetId) setSelectedProducts(selectedProducts.map(i => i.product.id === numpadTargetId ? { ...i, qty: val } : i)); }} />
            <datalist id="ledger-cats-ws">{categorySuggestions.map(cat => <option key={cat} value={cat} />)}</datalist>
        </div>
    );
};

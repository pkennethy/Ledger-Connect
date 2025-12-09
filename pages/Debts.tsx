import React, { useState, useMemo, useEffect } from 'react';
import { Search, FileText, ChevronDown, ChevronRight, Plus, X, Wallet, AlertCircle, History, Calendar, Mail, PenTool, ShoppingBag, LayoutGrid, LayoutList, Phone, User as UserIcon, Clock, ArrowRight as ArrowIcon, ArrowDownLeft, ArrowUpRight, Printer, Download } from 'lucide-react';
import { MockService } from '../services/mockData';
import { Language, DICTIONARY, DebtRecord, DebtStatus, Customer, Product, User, UserRole, RepaymentRecord } from '../types';
import { useToast } from '../context/ToastContext';

interface PageProps {
    lang: Language;
    user: User;
}

export const Debts: React.FC<PageProps> = ({ lang, user }) => {
    const t = DICTIONARY[lang];
    const isAdmin = user.role === UserRole.ADMIN;
    const { showToast } = useToast();

    // Helper for today's date (Local Time) YYYY-MM-DD
    const getTodayString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Helper to extract Local YYYY-MM-DD from ISO string
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
    
    // Modal States
    const [showAddModal, setShowAddModal] = useState(false);
    const [showRepayModal, setShowRepayModal] = useState(false);
    
    // Detail View State (Admin Mode: Selected Customer for Modal)
    const [selectedDetailCustomer, setSelectedDetailCustomer] = useState<any | null>(null);
    
    // Shared State for Filtering (Default to Today)
    const [detailDateFilter, setDetailDateFilter] = useState(getTodayString());
    
    // SOA Modal State
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportData, setReportData] = useState<{
        customer: Customer, 
        transactions: any[], 
        grandTotal: number, 
        date: string
    } | null>(null);

    // Force refresh
    const [refresh, setRefresh] = useState(0);

    // Add Debt Form State
    const [addDebtMode, setAddDebtMode] = useState<'product' | 'manual'>('product');
    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [selectedProducts, setSelectedProducts] = useState<Array<{product: Product, qty: number}>>([]);
    const [productDebtCategory, setProductDebtCategory] = useState<string>('General');
    const [debtDate, setDebtDate] = useState('');

    // Manual Debt Form State
    const [manualForm, setManualForm] = useState({ amount: '', category: '', description: '' });
    
    // Repay Form State
    const [repayCustomer, setRepayCustomer] = useState<string>('');
    const [repayCategory, setRepayCategory] = useState<string>('');
    const [repayAmount, setRepayAmount] = useState<string>('');

    // Initialize date on mount or when modal opens
    useEffect(() => {
        if (showAddModal) {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            setDebtDate(now.toISOString().slice(0, 16));
        }
    }, [showAddModal]);

    // --- DATA PREPARATION ---

    // Filter Customers based on Role - Exclude Admins from Debt List
    let visibleCustomers = MockService.getCustomers().filter(c => c.role !== UserRole.ADMIN);
    
    if (!isAdmin) {
        visibleCustomers = visibleCustomers.filter(c => c.id === user.id);
    } else {
        visibleCustomers = visibleCustomers.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    const allDebts = MockService.getDebts();
    const allProducts = MockService.getProducts();

    // Get unique categories for suggestions
    const categorySuggestions = useMemo(() => {
        const cats = new Set<string>();
        allDebts.forEach(d => cats.add(d.category));
        allProducts.forEach(p => cats.add(p.category));
        return Array.from(cats).sort();
    }, [allProducts, allDebts]);

    // Group debts by customer
    const customerDebts = visibleCustomers.map(cust => {
        const debts = allDebts.filter(d => d.customerId === cust.id);
        
        // Calculate category balances for the Repay modal
        const categories: Record<string, DebtRecord[]> = {};
        debts.forEach(d => {
            if (!categories[d.category]) categories[d.category] = [];
            categories[d.category].push(d);
        });

        return {
            ...cust,
            debts, // All raw debts for this customer
            categories // Grouped by category (legacy/repay use)
        };
    });

    // --- HELPERS ---

    const handleCustomerClick = (wrapper: any) => {
        setSelectedDetailCustomer(wrapper);
        setDetailDateFilter(getTodayString()); // Reset date filter to Today on open
    };

    const getLiveTotalDebt = (customerId: string) => {
        const debts = MockService.getDebts(customerId);
        // Sum of all unpaid amounts
        return debts.reduce((acc, d) => acc + (d.amount - d.paidAmount), 0);
    };

    const calculateHistoricalTotal = (customerId: string, dateLimit: string) => {
        const rawDebts = MockService.getDebts(customerId);
        const rawPayments = MockService.getRepayments(customerId);

        // Filter all transactions strictly BEFORE or ON the dateLimit
        const debtsUntilDate = rawDebts.filter(d => getLocalDateFromISO(d.createdAt) <= dateLimit);
        const paymentsUntilDate = rawPayments.filter(p => getLocalDateFromISO(p.timestamp) <= dateLimit);

        const totalDebt = debtsUntilDate.reduce((sum, d) => sum + d.amount, 0);
        const totalPaid = paymentsUntilDate.reduce((sum, p) => sum + p.amount, 0);

        return totalDebt - totalPaid;
    };

    // --- RENDER HELPERS ---
    
    // JOURNAL ENTRY LOGIC (Categorized)
    const renderLedgerList = (customerId: string) => {
        // 1. Fetch ALL transactions for this customer
        const rawDebts = MockService.getDebts(customerId);
        const rawPayments = MockService.getRepayments(customerId);

        // 2. Extract Unique Categories from both debts and payments
        const categories = Array.from(new Set([
            ...rawDebts.map(d => d.category),
            ...rawPayments.map(p => p.category)
        ])).sort();

        if (categories.length === 0) {
             return (
                <div className="text-center py-10 text-gray-400 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                    <FileText size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No transactions found.</p>
                </div>
            );
        }

        return (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                {categories.map(cat => {
                    // Filter transactions specific to this category
                    const catDebts = rawDebts.filter(d => d.category === cat);
                    const catPayments = rawPayments.filter(p => p.category === cat);
                    
                    if (catDebts.length === 0 && catPayments.length === 0) return null;

                    // Normalize to Ledger Entries
                    const txns = [
                        ...catDebts.map(d => ({
                            id: d.id,
                            date: d.createdAt,
                            desc: d.items.length > 0 
                                ? `${d.items[0].productName} ${d.items.length > 1 ? `+${d.items.length - 1} items` : ''}` 
                                : d.category,
                            category: d.category,
                            debit: d.amount,
                            credit: 0,
                            type: 'DEBT'
                        })),
                        ...catPayments.map(p => ({
                            id: p.id,
                            date: p.timestamp,
                            desc: `Payment Received`,
                            category: p.category,
                            debit: 0,
                            credit: p.amount,
                            type: 'PAYMENT'
                        }))
                    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    // Calculate Running Balance (Chronological)
                    let running = 0;
                    const fullLedger = txns.map(t => {
                        running += t.debit;
                        running -= t.credit;
                        return { ...t, balance: running };
                    });

                    // Snapshot Current Balance for Header (Default is Latest)
                    let currentCategoryBalance = fullLedger.length > 0 ? fullLedger[fullLedger.length - 1].balance : 0;

                    // Apply Date Filter Logic (Beginning Balance)
                    let displayLedger = fullLedger;
                    let startBal = 0;
                    let showStartBal = false;

                    if (detailDateFilter) {
                         const filterDateStr = detailDateFilter; // User input is already YYYY-MM-DD
                         
                         // Transactions strictly BEFORE the filter date used for Balance Forward
                         // We compare local dates
                         const prev = fullLedger.filter(t => getLocalDateFromISO(t.date) < filterDateStr);
                         if (prev.length > 0) {
                             startBal = prev[prev.length - 1].balance;
                         }

                         // RE-CALCULATE Header Balance: The balance at the END of the selected filter date
                         const untilDate = fullLedger.filter(t => getLocalDateFromISO(t.date) <= filterDateStr);
                         if (untilDate.length > 0) {
                             currentCategoryBalance = untilDate[untilDate.length - 1].balance;
                         } else {
                             // If no transactions happened yet by this date
                             currentCategoryBalance = 0;
                         }
                         
                         // Transactions matching the filter date (Local Date Match)
                         displayLedger = fullLedger.filter(t => getLocalDateFromISO(t.date) === filterDateStr);
                         showStartBal = true;
                    } else {
                        // If no filter, show Newest First for UI convenience
                        displayLedger = [...fullLedger].reverse();
                    }

                    // If filtered and no transactions for that day, but there is a balance, we still show the table
                    if (displayLedger.length === 0 && !showStartBal) return null;

                    return (
                        <div key={cat} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                            {/* Category Header */}
                            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wider flex items-center gap-2">
                                        {cat}
                                        {detailDateFilter && (
                                            <span className="text-[10px] normal-case bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                                                {new Date(detailDateFilter).toLocaleDateString()}
                                            </span>
                                        )}
                                    </h3>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-gray-500 uppercase font-medium">Outstanding</p>
                                    <p className={`font-mono font-bold ${currentCategoryBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        ₱{currentCategoryBalance.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm border-collapse">
                                    <thead className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 text-gray-400 font-medium text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-2 w-32">Date</th>
                                            <th className="px-4 py-2">Particulars</th>
                                            <th className="px-4 py-2 text-right w-24">Debit</th>
                                            <th className="px-4 py-2 text-right w-24">Credit</th>
                                            <th className="px-4 py-2 text-right w-28">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                                         {/* Beginning Balance Row */}
                                         {showStartBal && (
                                            <tr className="bg-amber-50/50 dark:bg-amber-900/10">
                                                <td className="px-4 py-2 text-xs font-mono text-gray-500">
                                                    {new Date(detailDateFilter).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-2 italic text-gray-600 dark:text-gray-400 font-medium">
                                                    Balance
                                                </td>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2"></td>
                                                <td className="px-4 py-2 text-right font-bold font-mono text-gray-800 dark:text-gray-200">
                                                    ₱{startBal.toLocaleString()}
                                                </td>
                                            </tr>
                                         )}

                                         {displayLedger.map(tx => (
                                             <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group">
                                                 <td className="px-4 py-2 text-xs text-gray-500">
                                                     <div>{new Date(tx.date).toLocaleDateString()}</div>
                                                     <div className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                                                         {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                     </div>
                                                 </td>
                                                 <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                                                     {tx.desc}
                                                 </td>
                                                 <td className="px-4 py-2 text-right font-mono text-red-600 bg-red-50/10">
                                                     {tx.debit > 0 ? `₱${tx.debit.toLocaleString()}` : ''}
                                                 </td>
                                                 <td className="px-4 py-2 text-right font-mono text-green-600 bg-green-50/10">
                                                     {tx.credit > 0 ? `₱${tx.credit.toLocaleString()}` : ''}
                                                 </td>
                                                 <td className="px-4 py-2 text-right font-mono font-medium text-gray-900 dark:text-gray-100">
                                                     ₱{tx.balance.toLocaleString()}
                                                 </td>
                                             </tr>
                                         ))}

                                         {displayLedger.length === 0 && !showStartBal && (
                                            <tr><td colSpan={5} className="p-4 text-center text-gray-400 text-xs italic">No activity for this period</td></tr>
                                         )}
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
        try {
            const cust = customerDebts.find(c => c.id === customerId);
            if (!cust) {
                showToast('Customer not found for report generation', 'error');
                return;
            }

            // Use the current date filter or default to today
            const targetDate = detailDateFilter || getTodayString();
            const rawDebts = MockService.getDebts(customerId);
            const rawPayments = MockService.getRepayments(customerId);
            
            const categories = Array.from(new Set([
                ...rawDebts.map(d => d.category),
                ...rawPayments.map(p => p.category)
            ])).sort();

            let grandTotalOutstanding = 0;
            const compiledTransactions: any[] = [];

            categories.forEach(cat => {
                const catDebts = rawDebts.filter(d => d.category === cat);
                const catPayments = rawPayments.filter(p => p.category === cat);
                
                if (catDebts.length === 0 && catPayments.length === 0) return;

                // Merge and sort
                const txns = [
                     ...catDebts.map(d => ({ date: d.createdAt, desc: d.items.length > 0 ? d.items[0].productName : d.category, debit: d.amount, credit: 0, category: cat })),
                     ...catPayments.map(p => ({ date: p.timestamp, desc: 'Payment', debit: 0, credit: p.amount, category: cat }))
                ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                // Calc running balance
                let running = 0;
                const fullLedger = txns.map(t => {
                    running += t.debit;
                    running -= t.credit;
                    return { ...t, balance: running };
                });

                // Split by date
                const prev = fullLedger.filter(t => getLocalDateFromISO(t.date) < targetDate); 
                const startBal = prev.length > 0 ? prev[prev.length - 1].balance : 0;
                
                const current = fullLedger.filter(t => getLocalDateFromISO(t.date) === targetDate);
                const endBal = current.length > 0 ? current[current.length - 1].balance : startBal;
                
                grandTotalOutstanding += endBal;

                // Add Balance Forward Row
                if (startBal !== 0) {
                     compiledTransactions.push({
                         date: targetDate,
                         desc: `Balance Forward (${cat})`,
                         category: cat,
                         debit: startBal > 0 ? startBal : 0,
                         credit: startBal < 0 ? Math.abs(startBal) : 0,
                         balance: startBal,
                         isHeader: true
                     });
                }

                // Add Current Transactions
                current.forEach(t => {
                    compiledTransactions.push(t);
                });
            });

            setReportData({
                customer: cust,
                transactions: compiledTransactions,
                grandTotal: grandTotalOutstanding,
                date: targetDate
            });
            setShowReportModal(true);
        } catch (e) {
            console.error("Error generating report", e);
            showToast("Failed to generate report", "error");
        }
    };

    const handleSendEmail = (customer: Customer) => {
        if (!customer.email) {
            showToast(`No email address found for ${customer.name}`, 'error');
            return;
        }
        showToast(`Sending ledger to ${customer.email}...`, 'info');
        setTimeout(() => showToast(`Sent to ${customer.email}`, 'success'), 1500);
    };

    const handleAddProduct = (productId: string) => {
        const product = allProducts.find(p => p.id === productId);
        if (!product) return;
        
        const existing = selectedProducts.find(p => p.product.id === productId);
        if (existing) {
            setSelectedProducts(selectedProducts.map(p => p.product.id === productId ? {...p, qty: p.qty + 1} : p));
        } else {
            setSelectedProducts([...selectedProducts, { product, qty: 1 }]);
        }
        showToast(`Added ${product.name}`, 'info');
    };

    const submitDebt = () => {
        if (!selectedCustomer) {
            showToast('Please select a customer', 'error');
            return;
        }

        const createdAt = debtDate ? new Date(debtDate).toISOString() : new Date().toISOString();

        if (addDebtMode === 'manual') {
            if (!manualForm.amount || !manualForm.category) {
                showToast('Amount and Category are required', 'error');
                return;
            }
            const amount = parseFloat(manualForm.amount);
            if (isNaN(amount) || amount <= 0) {
                showToast('Invalid amount', 'error');
                return;
            }

            MockService.createDebt({
                 id: `d-man-${Date.now()}`,
                 customerId: selectedCustomer,
                 amount: amount,
                 paidAmount: 0,
                 items: [{
                     productId: 'manual',
                     productName: manualForm.description || 'Manual Charge',
                     quantity: 1,
                     price: amount,
                     category: manualForm.category
                 }],
                 category: manualForm.category,
                 createdAt: createdAt,
                 status: DebtStatus.UNPAID,
                 notes: manualForm.description
            });
            showToast('Manual debt recorded', 'success');
        } else {
            if (selectedProducts.length === 0) {
                showToast('Please select items', 'error');
                return;
            }

            const debtCat = productDebtCategory.trim() || 'General';
            const allItems = selectedProducts.map(item => ({
                productId: item.product.id,
                productName: item.product.name,
                quantity: item.qty,
                price: item.product.price,
                category: item.product.category
            }));

            const totalAmount = allItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

            MockService.createDebt({
                id: `d-${Date.now()}-${Math.random()}`,
                customerId: selectedCustomer,
                amount: totalAmount,
                paidAmount: 0,
                items: allItems,
                category: debtCat,
                createdAt: createdAt,
                status: DebtStatus.UNPAID
            });

            showToast('Debt record created successfully', 'success');
        }

        setShowAddModal(false);
        setSelectedProducts([]);
        setSelectedCustomer('');
        setProductDebtCategory('General');
        setManualForm({ amount: '', category: '', description: '' });
        setRefresh(prev => prev + 1);
    };

    const handleOpenRepay = (customerId: string) => {
        setRepayCustomer(customerId);
        setRepayCategory('');
        setRepayAmount('');
        setShowRepayModal(true);
    };

    const submitRepayment = () => {
        if (!repayCustomer || !repayAmount) return;
        const amount = Number(repayAmount);
        
        if (repayCategory) {
            MockService.repayDebtByCategory(repayCustomer, repayCategory, amount);
        } else {
             showToast("Please select a category to pay against.", 'error');
             return;
        }

        setShowRepayModal(false);
        setRepayAmount('');
        setRepayCategory('');
        setRefresh(prev => prev + 1);
        showToast(`Payment of ₱${amount} recorded`, 'success');
        
        // Refresh selected details if open
        if (selectedDetailCustomer && selectedDetailCustomer.id === repayCustomer) {
             const updatedWrapper = customerDebts.find(c => c.id === repayCustomer);
             if (updatedWrapper) setSelectedDetailCustomer(updatedWrapper);
        }
    };

    const getSelectedCategoryBalance = () => {
        if (!repayCustomer || !repayCategory) return 0;
        const cust = customerDebts.find(c => c.id === repayCustomer);
        if (!cust || !cust.categories[repayCategory]) return 0;
        return cust.categories[repayCategory].reduce((acc, d) => acc + (d.amount - d.paidAmount), 0);
    };

    // --- MAIN RENDER ---
    
    // CUSTOMER DIRECT VIEW: Skip the Grid, Show Details Directly
    if (!isAdmin && customerDebts.length > 0) {
        const myself = customerDebts[0];
        
        // Use filtered balance if date is set, otherwise current total (LIVE calculation)
        const displayTotalDebt = detailDateFilter 
            ? calculateHistoricalTotal(myself.id, detailDateFilter) 
            : getLiveTotalDebt(myself.id);

        return (
            <div className="space-y-4 pb-20">
                {/* Sticky Control Header for Customer */}
                <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md -mx-4 px-4 pt-1 pb-2 shadow-sm transition-all">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                        <div className="flex items-center gap-2">
                             <h2 className="text-xl font-bold text-gray-800 dark:text-white">{t.my_debts}</h2>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto items-center">
                            <div className="relative flex-1 sm:flex-none">
                                <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input 
                                    type="date" 
                                    className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={detailDateFilter}
                                    onChange={(e) => setDetailDateFilter(e.target.value)}
                                />
                            </div>
                            {detailDateFilter && (
                                <button onClick={() => setDetailDateFilter('')} className="text-xs text-blue-600 hover:underline px-1">Clear</button>
                            )}
                             <button 
                                onClick={() => generateReport(myself.id)}
                                className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center shadow-sm"
                            >
                                <FileText size={16} className="mr-2" /> Export
                            </button>
                        </div>
                    </div>
                </div>

                {/* Outstanding Balance Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex items-center justify-between">
                    <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            {detailDateFilter ? `Balance as of ${new Date(detailDateFilter).toLocaleDateString()}` : 'Total Outstanding'}
                        </p>
                        <h3 className={`text-3xl font-bold ${displayTotalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            ₱{displayTotalDebt.toLocaleString()}
                        </h3>
                    </div>
                     <div className={`p-3 rounded-full ${displayTotalDebt > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        <Wallet size={32} />
                     </div>
                </div>

                {/* Ledger Content */}
                {renderLedgerList(myself.id)}
            </div>
        );
    }

    // ADMIN VIEW: Grid/List of Customers
    return (
        <div className="space-y-2 pb-20">
            {/* STICKY HEADER */}
            <div className="sticky top-0 z-20 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md -mx-4 px-4 pt-1 pb-2 shadow-sm transition-all">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            {t.debts}
                            <span className="text-xs font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                {customerDebts.length}
                            </span>
                        </h2>
                    </div>

                    <div className="flex flex-wrap gap-2 w-full xl:w-auto items-center">
                        {/* Search */}
                        <div className="relative flex-1 xl:w-64">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="Search customers..." 
                                className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-gray-100 dark:bg-gray-700 border-none focus:ring-2 focus:ring-blue-500 outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* View Toggle */}
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><LayoutList size={18} /></button>
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-400'}`}><LayoutGrid size={18} /></button>
                        </div>

                        {/* Add Debt Button */}
                        <button 
                            onClick={() => {
                                setShowAddModal(true);
                                setAddDebtMode('product');
                            }}
                            className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700 shadow-sm"
                        >
                            <Plus size={16} className="mr-1" /> Add Debt
                        </button>
                    </div>
                </div>
            </div>

            {/* CUSTOMER GRID / LIST (ADMIN ONLY) */}
            {customerDebts.length === 0 ? (
                 <div className="flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 min-h-[300px]">
                    <UserIcon size={48} className="mb-2 opacity-50" />
                    <p>No customers found</p>
                </div>
            ) : viewMode === 'list' ? (
                // --- TABLE VIEW ---
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Debt</th>
                                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {customerDebts.map(cust => (
                                    <tr 
                                        key={cust.id} 
                                        onClick={() => handleCustomerClick(cust)}
                                        className="hover:bg-blue-50/30 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                                    >
                                        <td className="px-4 py-2 flex items-center">
                                            <img src={cust.avatarUrl} className="w-8 h-8 rounded-full border border-gray-100 mr-3" alt="" />
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-gray-100">{cust.name}</div>
                                                <div className="text-xs text-gray-500">{cust.debts.length} records</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                             <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                                cust.totalDebt > 0 ? 'text-red-600 bg-red-50 border-red-200' : 'text-green-600 bg-green-50 border-green-200'
                                            }`}>
                                                ₱{cust.totalDebt.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenRepay(cust.id);
                                                }}
                                                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
                                            >
                                                Repay
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                // --- GRID VIEW (Immersive) ---
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
                     {customerDebts.map(cust => (
                        <div 
                            key={cust.id} 
                            onClick={() => handleCustomerClick(cust)}
                            className="relative aspect-square bg-gray-200 rounded-xl overflow-hidden group shadow-sm cursor-pointer"
                        >
                            <img src={cust.avatarUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={cust.name} />
                            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

                            {/* Top Right: Record Count */}
                            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <span className="text-[10px] text-white bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
                                    {cust.debts.length} Trans.
                                </span>
                            </div>

                            {/* Debt Badge */}
                            <div className={`absolute top-2 left-2 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm z-10 uppercase tracking-wider ${
                                cust.totalDebt > 0 ? 'bg-red-600/90' : 'bg-green-600/90'
                            }`}>
                                {cust.totalDebt > 0 ? `Due: ₱${cust.totalDebt.toLocaleString()}` : 'Clean'}
                            </div>

                             {/* Content */}
                             <div className="absolute bottom-0 left-0 w-full p-3 flex items-end justify-between gap-2 z-10">
                                <div className="flex-1 min-w-0">
                                    <div className="text-white font-bold text-lg leading-none mb-1 drop-shadow-md truncate">{cust.name}</div>
                                    <div className="flex items-center text-white/80 text-[10px] font-medium">
                                        <Phone size={10} className="mr-1" />
                                        {cust.phone}
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenRepay(cust.id);
                                    }}
                                    className="bg-white/20 hover:bg-white/30 text-white border border-white/40 p-2 rounded-full backdrop-blur-md shadow-lg transition-all active:scale-95 shrink-0"
                                >
                                    <Wallet size={18} strokeWidth={3} />
                                </button>
                            </div>
                        </div>
                     ))}
                </div>
            )}

            {/* --- CUSTOMER LEDGER MODAL (ADMIN ONLY) --- */}
            {selectedDetailCustomer && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 shrink-0">
                            <div className="flex items-center space-x-3">
                                <img src={selectedDetailCustomer.avatarUrl} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt="" />
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedDetailCustomer.name}</h3>
                                    <p className="text-sm text-gray-500">
                                        {detailDateFilter ? `Balance as of ${new Date(detailDateFilter).toLocaleDateString()}` : 'Total Outstanding'}
                                        : <span className="font-bold text-red-600">
                                            ₱{detailDateFilter 
                                                ? calculateHistoricalTotal(selectedDetailCustomer.id, detailDateFilter).toLocaleString() 
                                                : getLiveTotalDebt(selectedDetailCustomer.id).toLocaleString()
                                            }
                                        </span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setSelectedDetailCustomer(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
                            </div>
                        </div>

                        {/* Controls Toolbar */}
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-3 items-center justify-between bg-white dark:bg-gray-800 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="date" 
                                        className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={detailDateFilter}
                                        onChange={(e) => setDetailDateFilter(e.target.value)}
                                    />
                                </div>
                                {detailDateFilter && (
                                    <button onClick={() => setDetailDateFilter('')} className="text-xs text-blue-600 hover:underline">Clear Date</button>
                                )}
                            </div>
                            
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleSendEmail(selectedDetailCustomer)}
                                    className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 rounded-lg border border-gray-200"
                                    title="Email Ledger"
                                >
                                    <Mail size={18} />
                                </button>
                                <button 
                                    onClick={() => handleOpenRepay(selectedDetailCustomer.id)}
                                    className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 flex items-center"
                                >
                                    <Wallet size={16} className="mr-2" /> Repay
                                </button>
                                <button 
                                    onClick={() => generateReport(selectedDetailCustomer.id)}
                                    className="bg-white border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center"
                                >
                                    <FileText size={16} className="mr-2" /> Export
                                </button>
                            </div>
                        </div>

                        {/* Ledger Content (Reused Logic) */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/50">
                            {renderLedgerList(selectedDetailCustomer.id)}
                        </div>
                    </div>
                </div>
            )}

            {/* SOA / Report Modal (Visual) - Z-INDEX 200 (Above everything) */}
            {showReportModal && reportData && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-[200] flex items-center justify-center p-4">
                     <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[95vh]">
                         {/* Control Bar (Non-Printable) */}
                         <div className="bg-gray-800 text-white p-3 flex justify-between items-center shrink-0 no-print">
                            <h3 className="font-bold flex items-center gap-2"><FileText size={18}/> Print Preview</h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => window.print()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium flex items-center"
                                >
                                    <Printer size={16} className="mr-2"/> Print Statement
                                </button>
                                <button onClick={() => setShowReportModal(false)} className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg"><X size={18}/></button>
                            </div>
                         </div>

                         {/* Printable Area */}
                         <div className="flex-1 overflow-y-auto p-8 bg-white text-gray-900 printable-content">
                             {/* Header */}
                             <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                                 <div>
                                     <h1 className="text-3xl font-bold uppercase tracking-wide text-gray-800">Statement of Account</h1>
                                     <p className="text-gray-500 mt-1">Ledger Connect</p>
                                     <p className="text-sm text-gray-500">Philippines</p>
                                 </div>
                                 <div className="text-right">
                                     <p className="text-sm text-gray-500">Statement Date</p>
                                     <p className="font-bold text-lg">{new Date(reportData.date).toLocaleDateString()}</p>
                                 </div>
                             </div>

                             {/* Bill To */}
                             <div className="flex justify-between mb-8">
                                 <div className="w-1/2">
                                     <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Bill To</p>
                                     <h2 className="text-xl font-bold">{reportData.customer.name}</h2>
                                     <p className="text-gray-600">{reportData.customer.phone}</p>
                                     <p className="text-gray-600">{reportData.customer.address}</p>
                                 </div>
                                 <div className="w-1/3 bg-gray-50 p-4 rounded border border-gray-200">
                                     <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Total Amount Due</p>
                                     <p className="text-2xl font-bold text-red-600">₱{reportData.grandTotal.toLocaleString()}</p>
                                 </div>
                             </div>

                             {/* Transaction Table */}
                             <table className="w-full text-sm mb-8">
                                 <thead>
                                     <tr className="border-b-2 border-gray-200">
                                         <th className="text-left py-2 font-bold text-gray-600">Date</th>
                                         <th className="text-left py-2 font-bold text-gray-600">Description</th>
                                         <th className="text-right py-2 font-bold text-gray-600">Charge</th>
                                         <th className="text-right py-2 font-bold text-gray-600">Payment</th>
                                         <th className="text-right py-2 font-bold text-gray-600">Balance</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-100">
                                     {reportData.transactions.map((t, idx) => (
                                         <tr key={idx} className={t.isHeader ? 'bg-gray-50 font-medium' : ''}>
                                             <td className="py-2.5">{new Date(t.date).toLocaleDateString()}</td>
                                             <td className="py-2.5">
                                                 <span className={t.isHeader ? 'font-bold text-gray-800' : ''}>{t.desc}</span>
                                             </td>
                                             <td className="py-2.5 text-right">{t.debit > 0 ? `₱${t.debit.toLocaleString()}` : '-'}</td>
                                             <td className="py-2.5 text-right">{t.credit > 0 ? `(₱${t.credit.toLocaleString()})` : '-'}</td>
                                             <td className="py-2.5 text-right font-bold text-gray-700">₱{t.balance.toLocaleString()}</td>
                                         </tr>
                                     ))}
                                 </tbody>
                                 <tfoot className="border-t-2 border-gray-800">
                                     <tr>
                                         <td colSpan={4} className="py-4 text-right font-bold text-lg">Ending Balance</td>
                                         <td className="py-4 text-right font-bold text-lg text-red-600">₱{reportData.grandTotal.toLocaleString()}</td>
                                     </tr>
                                 </tfoot>
                             </table>

                             {/* Footer */}
                             <div className="mt-12 text-center text-sm text-gray-500 border-t border-gray-100 pt-6">
                                 <p className="italic mb-2">Thank you for your business!</p>
                                 <p className="text-xs">Generated by Ledger Connect System</p>
                             </div>
                         </div>
                     </div>
                </div>
            )}

            {/* Repay Modal */}
            {showRepayModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center">
                                <Wallet size={20} className="mr-2 text-blue-600" /> 
                                Record Repayment
                            </h3>
                            <button onClick={() => setShowRepayModal(false)}><X size={20} className="text-gray-400" /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Debt Category</label>
                                <select 
                                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    value={repayCategory}
                                    onChange={e => setRepayCategory(e.target.value)}
                                >
                                    <option value="">-- Select Category --</option>
                                    {Object.keys(customerDebts.find(c => c.id === repayCustomer)?.categories || {}).map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {repayCategory && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 flex items-start">
                                    <AlertCircle size={16} className="text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs text-blue-800 dark:text-blue-200 font-bold uppercase">Outstanding Balance</p>
                                        <p className="text-lg font-bold text-blue-700 dark:text-blue-300">₱{getSelectedCategoryBalance().toLocaleString()}</p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount to Pay</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">₱</span>
                                    <input 
                                        type="number" 
                                        className="w-full pl-8 p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="0.00"
                                        value={repayAmount}
                                        onChange={e => setRepayAmount(e.target.value)}
                                    />
                                </div>
                            </div>
                            
                            <button 
                                onClick={submitRepayment}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-md transition-colors"
                            >
                                Confirm Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Debt Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-[80] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 dark:text-white">Add New Debt Record</h3>
                            <button onClick={() => setShowAddModal(false)}><X size={20} className="text-gray-400" /></button>
                        </div>

                        {/* Mode Switcher */}
                        <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-lg mb-4">
                            <button 
                                onClick={() => setAddDebtMode('product')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center transition-all ${
                                    addDebtMode === 'product' 
                                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-white' 
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                <ShoppingBag size={16} className="mr-2" />
                                From Inventory
                            </button>
                            <button 
                                onClick={() => setAddDebtMode('manual')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center transition-all ${
                                    addDebtMode === 'manual' 
                                    ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-600 dark:text-white' 
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                <PenTool size={16} className="mr-2" />
                                Manual Entry
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Customer</label>
                                    <select 
                                        className="w-full p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={selectedCustomer}
                                        onChange={e => setSelectedCustomer(e.target.value)}
                                    >
                                        <option value="">-- Choose --</option>
                                        {MockService.getCustomers()
                                            .filter(c => c.role !== UserRole.ADMIN) // Exclude Admin
                                            .map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date & Time</label>
                                    <input 
                                        type="datetime-local" 
                                        className="w-full p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={debtDate}
                                        onChange={e => setDebtDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* PRODUCT SELECTION MODE */}
                            {addDebtMode === 'product' && (
                                <div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Debt Category / Group</label>
                                        <input 
                                            type="text" 
                                            list="category-suggestions"
                                            className="w-full p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            placeholder="e.g. Store Credit, Groceries, Loan"
                                            value={productDebtCategory}
                                            onChange={e => setProductDebtCategory(e.target.value)}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Groups selected items under this debt category.</p>
                                    </div>

                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add Items</label>
                                    <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                                        {allProducts.map(prod => (
                                            <button 
                                                key={prod.id}
                                                onClick={() => handleAddProduct(prod.id)}
                                                className="flex-shrink-0 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-left transition-colors"
                                            >
                                                <div className="font-bold text-gray-800 dark:text-white">{prod.name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">₱{prod.price}</div>
                                            </button>
                                        ))}
                                    </div>
                                    
                                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900 min-h-[100px]">
                                        {selectedProducts.length === 0 ? (
                                            <p className="text-sm text-gray-400 text-center py-4">No items selected</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedProducts.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between text-sm">
                                                        <span className="text-gray-800 dark:text-gray-200">{item.product.name} (x{item.qty})</span>
                                                        <span className="font-bold text-gray-900 dark:text-white">₱{item.product.price * item.qty}</span>
                                                    </div>
                                                ))}
                                                <div className="border-t border-gray-300 dark:border-gray-600 pt-2 flex justify-between font-bold text-base mt-2">
                                                    <span className="text-gray-900 dark:text-white">Total</span>
                                                    <span className="text-blue-600 dark:text-blue-400">
                                                        ₱{selectedProducts.reduce((sum, i) => sum + (i.product.price * i.qty), 0)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* MANUAL ENTRY MODE */}
                            {addDebtMode === 'manual' && (
                                <div className="space-y-4 border-t border-gray-100 dark:border-gray-700 pt-2">
                                     <div className="grid grid-cols-2 gap-4">
                                         <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-bold">₱</span>
                                                <input 
                                                    type="number" 
                                                    className="w-full pl-8 p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                    placeholder="0.00"
                                                    value={manualForm.amount}
                                                    onChange={e => setManualForm({...manualForm, amount: e.target.value})}
                                                />
                                            </div>
                                         </div>
                                         <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                            <input 
                                                type="text" 
                                                list="category-suggestions"
                                                className="w-full p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                placeholder="e.g. Loans"
                                                value={manualForm.category}
                                                onChange={e => setManualForm({...manualForm, category: e.target.value})}
                                            />
                                        </div>
                                     </div>

                                     <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description / Note</label>
                                        <input 
                                            type="text" 
                                            className="w-full p-2 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            placeholder="Description of debt..."
                                            value={manualForm.description}
                                            onChange={e => setManualForm({...manualForm, description: e.target.value})}
                                        />
                                     </div>
                                </div>
                            )}

                            <datalist id="category-suggestions">
                                {categorySuggestions.map(cat => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>

                            <button 
                                onClick={submitDebt}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 shadow-md mt-4"
                            >
                                {addDebtMode === 'manual' ? 'Record Manual Debt' : 'Record Debt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
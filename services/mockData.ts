
import { Customer, Product, Order, OrderStatus, DebtRecord, DebtStatus, User, UserRole, ReportSummary, SystemSettings, Language, RepaymentRecord } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// --- RUNTIME CACHE ---
let CACHE_CUSTOMERS: Customer[] = [];
let CACHE_PRODUCTS: Product[] = [];
let CACHE_ORDERS: Order[] = [];
let CACHE_DEBTS: DebtRecord[] = [];
let CACHE_REPAYMENTS: RepaymentRecord[] = [];

const DEFAULT_SETTINGS: SystemSettings = {
    language: Language.EN,
    theme: 'light',
    notifications: {
        email: true,
        push: true,
        emailOnDebt: true,
        emailOnPayment: true,
        emailOnDeletion: true,
    },
    backupEmail: ''
};

let CACHE_SETTINGS: SystemSettings = DEFAULT_SETTINGS;

export const MockService = {
  initialize: async () => {
      if (!isSupabaseConfigured()) {
          throw new Error("Supabase configuration missing. Database is required.");
      }

      try {
          const [cust, prod, ord, debts, repays] = await Promise.all([
              supabase.from('customers').select('*'),
              supabase.from('products').select('*'),
              supabase.from('orders').select('*'),
              supabase.from('debts').select('*'),
              supabase.from('repayments').select('*')
          ]);

          if (cust.error) throw cust.error;
          if (prod.error) throw prod.error;
          if (ord.error) throw ord.error;
          if (debts.error) throw debts.error;
          if (repays.error) throw repays.error;

          CACHE_CUSTOMERS = (cust.data as Customer[]) || [];
          CACHE_PRODUCTS = (prod.data as Product[]) || [];
          CACHE_ORDERS = (ord.data as Order[]) || [];
          CACHE_DEBTS = (debts.data as DebtRecord[]) || [];
          CACHE_REPAYMENTS = (repays.data as RepaymentRecord[]) || [];

          // CRITICAL: Recalculate all totals from records on startup to fix any drift
          CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => {
              const customerDebts = CACHE_DEBTS.filter(d => d.customerId === c.id);
              const customerPayments = CACHE_REPAYMENTS.filter(p => p.customerId === c.id);
              const calculatedBalance = customerDebts.reduce((s, d) => s + d.amount, 0) - 
                                         customerPayments.reduce((s, p) => s + p.amount, 0);
              return { ...c, totalDebt: Math.max(0, calculatedBalance) };
          });

      } catch (error) {
          console.error("Critical Database Sync Error:", error);
          throw error;
      }
  },

  // Helper to trigger email notification via Supabase Edge Function
  triggerTransactionEmail: async (customerId: string, txnType: 'DEBT' | 'REPAYMENT' | 'DELETION', amount: number, category: string) => {
      try {
          const settings = MockService.getSettings();
          if (!settings.notifications.email) return;

          // Check granular switches
          if (txnType === 'DEBT' && !settings.notifications.emailOnDebt) return;
          if (txnType === 'REPAYMENT' && !settings.notifications.emailOnPayment) return;
          if (txnType === 'DELETION' && !settings.notifications.emailOnDeletion) return;

          // We call the Supabase Edge Function 'transaction-report'
          await supabase.functions.invoke('transaction-report', {
              body: { customerId, txnType, amount, category }
          });
      } catch (e) {
          console.warn("Email notification trigger skipped or failed:", e);
      }
  },

  recalculateCustomerTotal: async (customerId: string) => {
    const debts = CACHE_DEBTS.filter(d => d.customerId === customerId);
    const payments = CACHE_REPAYMENTS.filter(p => p.customerId === customerId);
    
    const totalDebtAmount = debts.reduce((sum, d) => sum + d.amount, 0);
    const totalPaidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const newBalance = Math.max(0, totalDebtAmount - totalPaidAmount);

    const { error } = await supabase.from('customers').update({ totalDebt: newBalance }).eq('id', customerId);
    if (!error) {
        CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => c.id === customerId ? { ...c, totalDebt: newBalance } : c);
    }
    return newBalance;
  },

  checkTableHealth: async () => {
    if (!isSupabaseConfigured()) return { connected: false, tables: { customers: false, products: false, orders: false, debts: false, repayments: false } };
    try {
      const tableNames = ['customers', 'products', 'orders', 'debts', 'repayments'];
      const results: Record<string, boolean> = {};
      for (const name of tableNames) {
        const { error } = await supabase.from(name).select('id').limit(1);
        results[name] = !error;
      }
      const connected = Object.values(results).every(v => v === true);
      return { connected, tables: results };
    } catch (e) {
      return { connected: false, tables: { customers: false, products: false, orders: false, debts: false, repayments: false } };
    }
  },

  getCustomers: (): Customer[] => CACHE_CUSTOMERS,
  getProducts: (): Product[] => CACHE_PRODUCTS,
  getOrders: (customerId?: string): Order[] => {
      let orders = customerId ? CACHE_ORDERS.filter(o => o.customerId === customerId) : [...CACHE_ORDERS];
      return orders.sort((a, b) => {
          const score = (status: OrderStatus) => {
              switch (status) {
                  case OrderStatus.PENDING: return 0;
                  case OrderStatus.CONFIRMED: return 1;
                  case OrderStatus.DELIVERING: return 2;
                  case OrderStatus.COMPLETED: return 3;
                  case OrderStatus.CANCELLED: return 4;
                  default: return 99;
              }
          };
          const scoreA = score(a.status);
          const scoreB = score(b.status);
          return scoreA !== scoreB ? scoreA - scoreB : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  },
  getDebts: (customerId?: string): DebtRecord[] => customerId ? CACHE_DEBTS.filter(d => d.customerId === customerId) : CACHE_DEBTS,
  getRepayments: (customerId?: string): RepaymentRecord[] => {
      const r = customerId ? CACHE_REPAYMENTS.filter(r => r.customerId === customerId) : CACHE_REPAYMENTS;
      return [...r].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
  
  createDebt: async (debt: DebtRecord) => {
    const { error: debtErr } = await supabase.from('debts').insert(debt);
    if (debtErr) throw debtErr;

    CACHE_DEBTS.unshift(debt);
    await MockService.recalculateCustomerTotal(debt.customerId);
    
    // Trigger Admin Email
    await MockService.triggerTransactionEmail(debt.customerId, 'DEBT', debt.amount, debt.category);
    
    return debt;
  },

  deleteDebt: async (id: string) => {
    const debt = CACHE_DEBTS.find(d => d.id === id);
    if (!debt) return;
    const customerId = debt.customerId;
    const { error: delErr } = await supabase.from('debts').delete().eq('id', id);
    if (delErr) throw delErr;

    CACHE_DEBTS = CACHE_DEBTS.filter(d => d.id !== id);
    await MockService.recalculateCustomerTotal(customerId);
    
    // Trigger Admin Email for record correction
    await MockService.triggerTransactionEmail(customerId, 'DELETION', debt.amount, `Deleted Debt: ${debt.category}`);
  },

  deleteRepayment: async (id: string) => {
    const repay = CACHE_REPAYMENTS.find(r => r.id === id);
    if (!repay) return;
    const customerId = repay.customerId;

    const { error: repayErr } = await supabase.from('repayments').delete().eq('id', id);
    if (repayErr) throw repayErr;

    const customerDebts = CACHE_DEBTS.filter(d => 
        d.customerId === customerId && 
        d.category === repay.category && 
        d.paidAmount > 0
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let amountToRestore = repay.amount;
    for (const debt of customerDebts) {
        if (amountToRestore <= 0) break;
        const paidOnThisDebt = Math.min(debt.paidAmount, amountToRestore);
        debt.paidAmount -= paidOnThisDebt;
        amountToRestore -= paidOnThisDebt;
        debt.status = debt.paidAmount <= 0 ? DebtStatus.UNPAID : DebtStatus.PARTIAL;
        await supabase.from('debts').update({ paidAmount: debt.paidAmount, status: debt.status }).eq('id', debt.id);
    }

    CACHE_REPAYMENTS = CACHE_REPAYMENTS.filter(r => r.id !== id);
    await MockService.recalculateCustomerTotal(customerId);
    
    // Trigger Admin Email
    await MockService.triggerTransactionEmail(customerId, 'DELETION', repay.amount, `Deleted Repayment: ${repay.category}`);
  },
  
  repayDebtByCategory: async (customerId: string, category: string, amount: number) => {
      const customerDebts = CACHE_DEBTS.filter(d => d.customerId === customerId && d.category === category && d.status !== DebtStatus.PAID);
      let remainingPayment = amount;
      customerDebts.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      
      const debtsToUpdate: DebtRecord[] = [];
      for (const debt of customerDebts) {
          if (remainingPayment <= 0) break;
          const debtBalance = debt.amount - debt.paidAmount;
          const payment = Math.min(debtBalance, remainingPayment);
          debt.paidAmount += payment;
          remainingPayment -= payment;
          debt.status = debt.paidAmount >= debt.amount ? DebtStatus.PAID : DebtStatus.PARTIAL;
          debtsToUpdate.push(debt);
      }
      
      const totalPaid = amount - remainingPayment;
      if (totalPaid > 0) {
          const newRepayment: RepaymentRecord = { id: `pay-${Date.now()}`, customerId, amount: totalPaid, category, timestamp: new Date().toISOString(), method: 'CASH' };
          const { error: repErr } = await supabase.from('repayments').insert(newRepayment);
          if (repErr) throw repErr;
          CACHE_REPAYMENTS.unshift(newRepayment);

          for(const d of debtsToUpdate) {
              await supabase.from('debts').update({ paidAmount: d.paidAmount, status: d.status }).eq('id', d.id);
          }
          await MockService.recalculateCustomerTotal(customerId);
          
          // Trigger Admin Email
          await MockService.triggerTransactionEmail(customerId, 'REPAYMENT', totalPaid, category);
      }
  },

  processPOSTransaction: async (customerId: string, items: {product: Product, qty: number}[], isCash: boolean, categoryMap?: Record<string, string>) => {
      const customer = CACHE_CUSTOMERS.find(c => c.id === customerId);
      if (!customer) throw new Error("Customer not found");
      
      const totalAmount = items.reduce((sum, i) => sum + (i.product.price * i.qty), 0);
      const orderId = `ord-${Date.now()}`;
      const order: Order = {
          id: orderId,
          customerId: customer.id,
          customerName: customer.name,
          items: items.map(i => ({ productId: i.product.id, productName: i.product.name, quantity: i.qty, price: i.product.price, category: categoryMap?.[i.product.id] || i.product.category })),
          totalAmount: totalAmount,
          status: isCash ? OrderStatus.COMPLETED : OrderStatus.CONFIRMED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };

      const itemsByCategory: Record<string, typeof order.items> = {};
      order.items.forEach(item => {
          if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
          itemsByCategory[item.category].push(item);
      });

      const newDebts: DebtRecord[] = [];
      const newRepayments: RepaymentRecord[] = [];
      Object.entries(itemsByCategory).forEach(([category, catItems]) => {
          const catAmount = catItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          newDebts.push({
              id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              customerId: customer.id,
              orderId: orderId,
              amount: catAmount,
              paidAmount: isCash ? catAmount : 0,
              items: catItems,
              category: category,
              createdAt: new Date().toISOString(),
              status: isCash ? DebtStatus.PAID : DebtStatus.UNPAID
          });
      });

      if (isCash) {
          newRepayments.push({ id: `pay-pos-${Date.now()}`, customerId: customer.id, amount: totalAmount, category: 'POS Cash Sale', timestamp: new Date().toISOString(), method: 'CASH' });
      }

      const { error: orderErr } = await supabase.from('orders').insert(order);
      if (orderErr) throw orderErr;

      const { error: debtErr } = await supabase.from('debts').insert(newDebts);
      if (debtErr) throw debtErr;

      if (isCash) {
          const { error: repayErr } = await supabase.from('repayments').insert(newRepayments);
          if (repayErr) throw repayErr;
      }

      for (const item of items) {
          const product = CACHE_PRODUCTS.find(p => p.id === item.product.id);
          if (product) {
              const newStock = Math.max(0, product.stock - item.qty);
              await supabase.from('products').update({ stock: newStock }).eq('id', product.id);
              product.stock = newStock;
          }
      }

      CACHE_ORDERS.unshift(order);
      CACHE_DEBTS.unshift(...newDebts);
      if (isCash) CACHE_REPAYMENTS.unshift(...newRepayments);
      await MockService.recalculateCustomerTotal(customerId);

      // Trigger Admin Email if it was a credit transaction
      if (!isCash) {
          await MockService.triggerTransactionEmail(customerId, 'DEBT', totalAmount, 'POS Credit');
      } else {
          await MockService.triggerTransactionEmail(customerId, 'REPAYMENT', totalAmount, 'POS Cash Sale');
      }
  },

  checkUserStatus: async (phone: string) => {
    const { data, error } = await supabase.from('customers').select('*').eq('phone', phone).single();
    if (error && error.code !== 'PGRST116') throw error;
    let profile = data as Customer;
    let userRole = UserRole.CUSTOMER;
    let exists = !!profile;
    if (profile) {
        userRole = profile.role || UserRole.CUSTOMER;
    } else {
        const { data: admins } = await supabase.from('customers').select('id').eq('role', 'ADMIN').limit(1);
        if (!admins || admins.length === 0) userRole = UserRole.ADMIN;
    }
    return { exists, role: userRole, nextUserRole: userRole };
  },

  authenticate: async (phone: string, password?: string, isRegistering = false): Promise<User | null> => {
    const digitsOnly = phone.replace(/\D/g, '');
    const email = `${digitsOnly}@ledger.com`;
    const effectivePassword = password || 'customer-default-secret'; 
    const { role: targetRole } = await MockService.checkUserStatus(phone);
    if (targetRole === UserRole.ADMIN) {
        if (isRegistering) {
            const { data, error } = await supabase.auth.signUp({ email, password: effectivePassword });
            if (error) throw error;
            if (!data.user) throw new Error("Registration failed");
            const newUser: Customer = { id: data.user.id, name: 'Admin', phone, address: 'Philippines', totalDebt: 0, avatarUrl: `https://ui-avatars.com/api/?name=Admin&background=random`, email, role: UserRole.ADMIN, password: effectivePassword };
            await supabase.from('customers').insert(newUser);
            CACHE_CUSTOMERS.push(newUser);
            return newUser as User;
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password: effectivePassword });
            if (error) throw error;
            const { data: profile } = await supabase.from('customers').select('*').eq('id', data.user?.id).single();
            if (!profile) throw new Error("Admin profile not found");
            return { ...profile, password: effectivePassword } as User;
        }
    }
    if (isRegistering) {
        throw new Error("Registration is disabled. Please ask the Admin to create your account.");
    } else {
        try { await supabase.auth.signInWithPassword({ email, password: effectivePassword }); } catch (e) {}
        const { data: profile } = await supabase.from('customers').select('*').eq('phone', phone).single();
        if (!profile) return null;
        return { ...profile, password: effectivePassword } as User;
    }
  },
  
  // Expose existing methods
  updateCustomer: async (id: string, updates: Partial<Customer>) => {
    const { error } = await supabase.from('customers').update(updates).eq('id', id);
    if (error) throw error;
    CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => c.id === id ? { ...c, ...updates } : c);
  },
  deleteCustomer: async (id: string) => {
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) throw error;
    CACHE_CUSTOMERS = CACHE_CUSTOMERS.filter(c => c.id !== id);
  },
  addCustomer: async (customer: Customer) => {
    const { error } = await supabase.from('customers').insert(customer);
    if (error) throw error;
    CACHE_CUSTOMERS.push(customer);
    return customer;
  },
  addProduct: async (product: Product) => {
    const { error } = await supabase.from('products').insert(product);
    if (error) throw error;
    CACHE_PRODUCTS.push(product);
    return product;
  },
  updateProduct: async (id: string, updates: Partial<Product>) => {
    const { error } = await supabase.from('products').update(updates).eq('id', id);
    if (error) throw error;
    CACHE_PRODUCTS = CACHE_PRODUCTS.map(p => p.id === id ? { ...p, ...updates } : p);
  },
  deleteProduct: async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
    CACHE_PRODUCTS = CACHE_PRODUCTS.filter(p => p.id !== id);
  },
  updateOrder: async (id: string, updates: Partial<Order>) => {
    const updatedAt = new Date().toISOString();
    const { error } = await supabase.from('orders').update({ ...updates, updatedAt }).eq('id', id);
    if (error) throw error;
    CACHE_ORDERS = CACHE_ORDERS.map(o => o.id === id ? { ...o, ...updates, updatedAt } : o);
  },
  confirmOrder: async (orderId: string, categoryMap?: Record<string, string>) => {
    const order = CACHE_ORDERS.find(o => o.id === orderId);
    if (!order) return;
    if (categoryMap) {
        order.items = order.items.map(item => ({ ...item, category: categoryMap[item.productId] || item.category }));
    }
    const updatedAt = new Date().toISOString();
    const itemsByCategory: Record<string, typeof order.items> = {};
    order.items.forEach(item => {
        if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
        itemsByCategory[item.category].push(item);
    });
    const newDebts: DebtRecord[] = [];
    Object.entries(itemsByCategory).forEach(([category, items]) => {
        const amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        newDebts.push({
            id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            customerId: order.customerId,
            orderId: order.id,
            amount: amount,
            paidAmount: 0,
            items: items,
            category: category,
            createdAt: new Date().toISOString(),
            status: DebtStatus.UNPAID
        });
    });
    const { error: orderErr } = await supabase.from('orders').update({ status: OrderStatus.CONFIRMED, updatedAt, items: order.items }).eq('id', orderId);
    if (orderErr) throw orderErr;
    const { error: debtErr } = await supabase.from('debts').insert(newDebts);
    if (debtErr) throw debtErr;
    order.status = OrderStatus.CONFIRMED;
    order.updatedAt = updatedAt;
    CACHE_DEBTS.unshift(...newDebts);
    await MockService.recalculateCustomerTotal(order.customerId);
    await MockService.triggerTransactionEmail(order.customerId, 'DEBT', order.totalAmount, 'Order Confirmed');
  },
  updateDebtCategory: async (debtId: string, newCategory: string) => {
      const debt = CACHE_DEBTS.find(d => d.id === debtId);
      if (debt) {
          const updatedItems = debt.items ? debt.items.map(i => ({ ...i, category: newCategory })) : [];
          const { error } = await supabase.from('debts').update({ category: newCategory, items: updatedItems }).eq('id', debtId);
          if (error) throw error;
          debt.category = newCategory;
          if (debt.items) debt.items = updatedItems;
      }
  },
  updateRepaymentCategory: async (repayId: string, newCategory: string) => {
      const repay = CACHE_REPAYMENTS.find(r => r.id === repayId);
      if (repay) {
          const { error } = await supabase.from('repayments').update({ category: newCategory }).eq('id', repayId);
          if (error) throw error;
          repay.category = newCategory;
      }
  },
  getSettings: (): SystemSettings => CACHE_SETTINGS,
  updateSettings: (settings: Partial<SystemSettings>) => {
      CACHE_SETTINGS = { ...CACHE_SETTINGS, ...settings };
      return CACHE_SETTINGS;
  },
  getBackupData: () => {
    return { customers: CACHE_CUSTOMERS, products: CACHE_PRODUCTS, orders: CACHE_ORDERS, debts: CACHE_DEBTS, repayments: CACHE_REPAYMENTS };
  },
  restoreBackupData: async (data: any) => {
    if (!isSupabaseConfigured()) throw new Error("Supabase not configured");
    const { customers, products, orders, debts, repayments } = data;
    try {
        if (customers && customers.length > 0) await supabase.from('customers').upsert(customers);
        if (products && products.length > 0) await supabase.from('products').upsert(products);
        if (orders && orders.length > 0) await supabase.from('orders').upsert(orders);
        if (debts && debts.length > 0) await supabase.from('debts').upsert(debts);
        if (repayments && repayments.length > 0) await supabase.from('repayments').upsert(repayments);
    } catch (e) { throw e; }
  },
  factoryReset: () => { localStorage.clear(); window.location.reload(); },
  getSummary: (): ReportSummary => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const totalDebt = CACHE_CUSTOMERS.reduce((acc, curr) => acc + curr.totalDebt, 0);
    const todayDebt = CACHE_DEBTS.filter(d => d.createdAt.startsWith(today)).reduce((acc, curr) => acc + curr.amount, 0);
    const todayCashSales = CACHE_ORDERS.filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(today)).reduce((acc, curr) => acc + curr.totalAmount, 0);
    const todayRepayments = CACHE_REPAYMENTS.filter(r => r.timestamp.startsWith(today)).reduce((acc, curr) => acc + curr.amount, 0);
    const monthCashSales = CACHE_ORDERS.filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(currentMonth)).reduce((acc, curr) => acc + curr.totalAmount, 0);
    const monthRepayments = CACHE_REPAYMENTS.filter(r => r.timestamp.startsWith(currentMonth)).reduce((acc, curr) => acc + curr.amount, 0);
    return { todayDebt, todayIncome: todayCashSales + todayRepayments, monthIncome: monthCashSales + monthRepayments, totalDebt };
  },
  changePassword: async (id: string, newPass: string) => {
      const { error } = await supabase.from('customers').update({ password: newPass }).eq('id', id);
      if (error) throw error;
      CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => c.id === id ? { ...c, password: newPass } : c);
  },
  getLastUsedCategory: (customerId: string, productId: string): string | undefined => {
      const debts = CACHE_DEBTS.filter(d => d.customerId === customerId);
      for (const debt of debts) { if (debt.items.some(i => i.productId === productId)) return debt.category; }
      return undefined;
  },
};
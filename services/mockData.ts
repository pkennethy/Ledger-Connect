
import { Customer, Product, Order, OrderStatus, DebtRecord, DebtStatus, User, UserRole, ReportSummary, SystemSettings, Language, RepaymentRecord } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// --- INITIAL STATE ---
const DEFAULT_CUSTOMERS: Customer[] = [];
const DEFAULT_PRODUCTS: Product[] = [];
const DEFAULT_ORDERS: Order[] = [];
const DEFAULT_DEBTS: DebtRecord[] = [];
const DEFAULT_REPAYMENTS: RepaymentRecord[] = [];

// --- LOCAL CACHE ---
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
    },
    backupEmail: ''
};

let CACHE_SETTINGS: SystemSettings = DEFAULT_SETTINGS;

const saveLocal = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save local data", e);
  }
};

const loadLocal = <T>(key: string, defaultData: T): T => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultData;
    } catch (e) {
      console.warn(`Failed to load ${key}, using default`, e);
      return defaultData;
    }
};

const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);

export const MockService = {
  initialize: async () => {
      CACHE_CUSTOMERS = loadLocal('LC_CUSTOMERS', DEFAULT_CUSTOMERS);
      CACHE_PRODUCTS = loadLocal('LC_PRODUCTS', DEFAULT_PRODUCTS);
      CACHE_ORDERS = loadLocal('LC_ORDERS', DEFAULT_ORDERS);
      CACHE_DEBTS = loadLocal('LC_DEBTS', DEFAULT_DEBTS);
      CACHE_REPAYMENTS = loadLocal('LC_REPAYMENTS', DEFAULT_REPAYMENTS);
      CACHE_SETTINGS = loadLocal('LC_SETTINGS', DEFAULT_SETTINGS);

      CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => ({
          ...c,
          email: c.email || `${c.name.replace(/\s/g, '').toLowerCase()}@example.com`
      }));

      if (!isSupabaseConfigured()) return;

      try {
          const results = await Promise.allSettled([
              supabase.from('customers').select('*'),
              supabase.from('products').select('*'),
              supabase.from('orders').select('*'),
              supabase.from('debts').select('*'),
              supabase.from('repayments').select('*')
          ]);

          const [cust, prod, ord, debts, repays] = results;

          if (cust.status === 'fulfilled' && cust.value.data) CACHE_CUSTOMERS = cust.value.data as Customer[];
          if (prod.status === 'fulfilled' && prod.value.data) CACHE_PRODUCTS = prod.value.data as Product[];
          if (ord.status === 'fulfilled' && ord.value.data) CACHE_ORDERS = ord.value.data as Order[];
          if (debts.status === 'fulfilled' && debts.value.data) CACHE_DEBTS = debts.value.data as DebtRecord[];
          if (repays.status === 'fulfilled' && repays.value.data) CACHE_REPAYMENTS = repays.value.data as RepaymentRecord[];
      } catch (error) {
          console.error("Error syncing with Supabase:", error);
      }
  },

  checkTableHealth: async () => {
      if (!isSupabaseConfigured()) return { connected: false, tables: {} };
      const tables = ['customers', 'products', 'orders', 'debts', 'repayments'];
      const status: Record<string, boolean> = {};
      for (const table of tables) {
          try {
              const { error } = await supabase.from(table).select('id').limit(1);
              status[table] = !(error && error.code === '42P01');
          } catch (e) {
              status[table] = false;
          }
      }
      return { connected: true, tables: status };
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
  getLastUsedCategory: (customerId: string, productId: string): string | undefined => {
      const debts = CACHE_DEBTS.filter(d => d.customerId === customerId);
      for (const debt of debts) {
          if (debt.items.some(i => i.productId === productId)) return debt.category;
      }
      return undefined;
  },

  getSummary: (): ReportSummary => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const totalDebt = CACHE_DEBTS.reduce((acc, curr) => acc + (curr.amount - curr.paidAmount), 0);
    const todayDebt = CACHE_DEBTS.filter(d => d.createdAt.startsWith(today)).reduce((acc, curr) => acc + curr.amount, 0);
    const todayCashSales = CACHE_ORDERS.filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(today)).reduce((acc, curr) => acc + curr.totalAmount, 0);
    const todayRepayments = CACHE_REPAYMENTS.filter(r => r.timestamp.startsWith(today)).reduce((acc, curr) => acc + curr.amount, 0);
    const monthCashSales = CACHE_ORDERS.filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(currentMonth)).reduce((acc, curr) => acc + curr.totalAmount, 0);
    const monthRepayments = CACHE_REPAYMENTS.filter(r => r.timestamp.startsWith(currentMonth)).reduce((acc, curr) => acc + curr.amount, 0);
    return { todayDebt, todayIncome: todayCashSales + todayRepayments, monthIncome: monthCashSales + monthRepayments, totalDebt };
  },

  addCustomer: async (customer: Customer) => {
    CACHE_CUSTOMERS.push(customer);
    saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
    if (isSupabaseConfigured()) await supabase.from('customers').insert(customer);
    return customer;
  },
  updateCustomer: async (id: string, updates: Partial<Customer>) => {
    CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => c.id === id ? { ...c, ...updates } : c);
    saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
    if (isSupabaseConfigured()) await supabase.from('customers').update(updates).eq('id', id);
  },
  changePassword: async (id: string, newPass: string) => {
      CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => c.id === id ? { ...c, password: newPass } : c);
      saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
      if (isSupabaseConfigured()) {
          const { error } = await supabase.auth.updateUser({ password: newPass });
          if (error) throw error;
      }
  },
  deleteCustomer: async (id: string) => {
    CACHE_CUSTOMERS = CACHE_CUSTOMERS.filter(c => c.id !== id);
    saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
    if (isSupabaseConfigured()) await supabase.from('customers').delete().eq('id', id);
  },
  addProduct: async (product: Product) => {
    CACHE_PRODUCTS.push(product);
    saveLocal('LC_PRODUCTS', CACHE_PRODUCTS);
    if (isSupabaseConfigured()) await supabase.from('products').insert(product);
    return product;
  },
  updateProduct: async (id: string, updates: Partial<Product>) => {
    CACHE_PRODUCTS = CACHE_PRODUCTS.map(p => p.id === id ? { ...p, ...updates } : p);
    saveLocal('LC_PRODUCTS', CACHE_PRODUCTS);
    if (isSupabaseConfigured()) await supabase.from('products').update(updates).eq('id', id);
  },
  deleteProduct: async (id: string) => {
    CACHE_PRODUCTS = CACHE_PRODUCTS.filter(p => p.id !== id);
    saveLocal('LC_PRODUCTS', CACHE_PRODUCTS);
    if (isSupabaseConfigured()) await supabase.from('products').delete().eq('id', id);
  },
  createOrder: async (order: Order) => {
    CACHE_ORDERS.unshift(order);
    saveLocal('LC_ORDERS', CACHE_ORDERS);
    if (isSupabaseConfigured()) await supabase.from('orders').insert(order);
    return order;
  },
  updateOrder: async (id: string, updates: Partial<Order>) => {
    const updatedAt = new Date().toISOString();
    CACHE_ORDERS = CACHE_ORDERS.map(o => o.id === id ? { ...o, ...updates, updatedAt } : o);
    saveLocal('LC_ORDERS', CACHE_ORDERS);
    if (isSupabaseConfigured()) await supabase.from('orders').update({ ...updates, updatedAt }).eq('id', id);
  },
  confirmOrder: async (orderId: string, categoryMap?: Record<string, string>) => {
    const order = CACHE_ORDERS.find(o => o.id === orderId);
    if (!order) return;
    if (categoryMap) {
        order.items = order.items.map(item => ({ ...item, category: categoryMap[item.productId] || item.category }));
    }
    order.status = OrderStatus.CONFIRMED;
    order.updatedAt = new Date().toISOString();
    const itemsByCategory: Record<string, typeof order.items> = {};
    order.items.forEach(item => {
        if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
        itemsByCategory[item.category].push(item);
    });
    const newDebts: DebtRecord[] = [];
    Object.entries(itemsByCategory).forEach(([category, items]) => {
        const amount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const debt: DebtRecord = {
            id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            customerId: order.customerId,
            orderId: order.id,
            amount: amount,
            paidAmount: 0,
            items: items,
            category: category,
            createdAt: new Date().toISOString(),
            status: DebtStatus.UNPAID
        };
        CACHE_DEBTS.unshift(debt);
        newDebts.push(debt);
    });
    const customer = CACHE_CUSTOMERS.find(c => c.id === order.customerId);
    if(customer) {
      customer.totalDebt += order.totalAmount;
      if (isSupabaseConfigured()) await supabase.from('customers').update({ totalDebt: customer.totalDebt }).eq('id', customer.id);
    }
    saveLocal('LC_ORDERS', CACHE_ORDERS);
    saveLocal('LC_DEBTS', CACHE_DEBTS);
    saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
    if (isSupabaseConfigured()) {
        await supabase.from('orders').update({ status: OrderStatus.CONFIRMED, updatedAt: order.updatedAt, items: order.items }).eq('id', orderId);
        if (newDebts.length > 0) await supabase.from('debts').insert(newDebts);
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
      CACHE_ORDERS.unshift(order);
      const itemsByCategory: Record<string, typeof order.items> = {};
      order.items.forEach(item => {
          if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
          itemsByCategory[item.category].push(item);
      });
      const newDebts: DebtRecord[] = [];
      const newRepayments: RepaymentRecord[] = [];
      Object.entries(itemsByCategory).forEach(([category, catItems]) => {
          const catAmount = catItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const debt: DebtRecord = {
              id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              customerId: customer.id,
              orderId: orderId,
              amount: catAmount,
              paidAmount: isCash ? catAmount : 0,
              items: catItems,
              category: category,
              createdAt: new Date().toISOString(),
              status: isCash ? DebtStatus.PAID : DebtStatus.UNPAID
          };
          CACHE_DEBTS.unshift(debt);
          newDebts.push(debt);
      });
      if (isCash) {
          const repay: RepaymentRecord = { id: `pay-pos-${Date.now()}`, customerId: customer.id, amount: totalAmount, category: 'POS Cash Sale', timestamp: new Date().toISOString(), method: 'CASH' };
          CACHE_REPAYMENTS.unshift(repay);
          newRepayments.push(repay);
      } else {
          customer.totalDebt += totalAmount;
      }
      items.forEach(item => {
          const product = CACHE_PRODUCTS.find(p => p.id === item.product.id);
          if (product) product.stock = Math.max(0, product.stock - item.qty);
      });
      saveLocal('LC_ORDERS', CACHE_ORDERS);
      saveLocal('LC_DEBTS', CACHE_DEBTS);
      saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
      saveLocal('LC_PRODUCTS', CACHE_PRODUCTS);
      saveLocal('LC_REPAYMENTS', CACHE_REPAYMENTS);
      if (isSupabaseConfigured()) {
          await supabase.from('orders').insert(order);
          if (newDebts.length > 0) await supabase.from('debts').insert(newDebts);
          if (newRepayments.length > 0) await supabase.from('repayments').insert(newRepayments);
          if (!isCash) await supabase.from('customers').update({ totalDebt: customer.totalDebt }).eq('id', customer.id);
          for (const item of items) {
             const p = CACHE_PRODUCTS.find(p => p.id === item.product.id);
             if(p) await supabase.from('products').update({ stock: p.stock }).eq('id', p.id);
          }
      }
  },

  createDebt: async (debt: DebtRecord) => {
    CACHE_DEBTS.unshift(debt);
    const customer = CACHE_CUSTOMERS.find(c => c.id === debt.customerId);
    if(customer) {
      customer.totalDebt += debt.amount;
      saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
      if (isSupabaseConfigured()) await supabase.from('customers').update({ totalDebt: customer.totalDebt }).eq('id', customer.id);
    }
    saveLocal('LC_DEBTS', CACHE_DEBTS);
    if (isSupabaseConfigured()) await supabase.from('debts').insert(debt);
    return debt;
  },

  updateDebtCategory: async (debtId: string, newCategory: string) => {
      const debt = CACHE_DEBTS.find(d => d.id === debtId);
      if (debt) {
          debt.category = newCategory;
          if (debt.items) debt.items.forEach(i => i.category = newCategory);
          saveLocal('LC_DEBTS', CACHE_DEBTS);
          if (isSupabaseConfigured()) await supabase.from('debts').update({ category: newCategory, items: debt.items }).eq('id', debtId);
      }
  },

  deleteDebt: async (id: string) => {
    const debt = CACHE_DEBTS.find(d => d.id === id);
    if (!debt) return;
    const customer = CACHE_CUSTOMERS.find(c => c.id === debt.customerId);
    if (customer) {
        customer.totalDebt -= (debt.amount - debt.paidAmount);
        saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
        if (isSupabaseConfigured()) await supabase.from('customers').update({ totalDebt: customer.totalDebt }).eq('id', customer.id);
    }
    CACHE_DEBTS = CACHE_DEBTS.filter(d => d.id !== id);
    saveLocal('LC_DEBTS', CACHE_DEBTS);
    if (isSupabaseConfigured()) await supabase.from('debts').delete().eq('id', id);
  },

  deleteRepayment: async (id: string) => {
    const repay = CACHE_REPAYMENTS.find(r => r.id === id);
    if (!repay) return;
    const customer = CACHE_CUSTOMERS.find(c => c.id === repay.customerId);
    if (customer) {
        customer.totalDebt += repay.amount;
        saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
        if (isSupabaseConfigured()) await supabase.from('customers').update({ totalDebt: customer.totalDebt }).eq('id', customer.id);
    }
    CACHE_REPAYMENTS = CACHE_REPAYMENTS.filter(r => r.id !== id);
    saveLocal('LC_REPAYMENTS', CACHE_REPAYMENTS);
    if (isSupabaseConfigured()) await supabase.from('repayments').delete().eq('id', id);
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
      const customer = CACHE_CUSTOMERS.find(c => c.id === customerId);
      if(customer) customer.totalDebt -= totalPaid;
      let newRepayment: RepaymentRecord | null = null;
      if (totalPaid > 0) {
          newRepayment = { id: `pay-${Date.now()}`, customerId, amount: totalPaid, category, timestamp: new Date().toISOString(), method: 'CASH' };
          CACHE_REPAYMENTS.unshift(newRepayment);
      }
      saveLocal('LC_DEBTS', CACHE_DEBTS);
      saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
      saveLocal('LC_REPAYMENTS', CACHE_REPAYMENTS);
      if (isSupabaseConfigured()) {
          for(const d of debtsToUpdate) await supabase.from('debts').update({ paidAmount: d.paidAmount, status: d.status }).eq('id', d.id);
          if (customer) await supabase.from('customers').update({ totalDebt: customer.totalDebt }).eq('id', customer.id);
          if (newRepayment) await supabase.from('repayments').insert(newRepayment);
      }
  },

  getSettings: (): SystemSettings => CACHE_SETTINGS,

  updateSettings: (settings: Partial<SystemSettings>) => {
      CACHE_SETTINGS = { ...CACHE_SETTINGS, ...settings };
      saveLocal('LC_SETTINGS', CACHE_SETTINGS);
      return CACHE_SETTINGS;
  },

  getBackupData: () => {
      return {
          customers: CACHE_CUSTOMERS,
          products: CACHE_PRODUCTS,
          orders: CACHE_ORDERS,
          debts: CACHE_DEBTS,
          repayments: CACHE_REPAYMENTS,
          settings: CACHE_SETTINGS
      };
  },

  restoreBackupData: (data: any) => {
      if (data.customers) { CACHE_CUSTOMERS = data.customers; saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS); }
      if (data.products) { CACHE_PRODUCTS = data.products; saveLocal('LC_PRODUCTS', CACHE_PRODUCTS); }
      if (data.orders) { CACHE_ORDERS = data.orders; saveLocal('LC_ORDERS', CACHE_ORDERS); }
      if (data.debts) { CACHE_DEBTS = data.debts; saveLocal('LC_DEBTS', CACHE_DEBTS); }
      if (data.repayments) { CACHE_REPAYMENTS = data.repayments; saveLocal('LC_REPAYMENTS', CACHE_REPAYMENTS); }
      if (data.settings) { CACHE_SETTINGS = data.settings; saveLocal('LC_SETTINGS', CACHE_SETTINGS); }
  },

  factoryReset: () => {
      localStorage.clear();
      window.location.reload();
  },

  checkUserStatus: async (phone: string) => {
    const inputLast10 = normalizePhone(phone);
    let profile = CACHE_CUSTOMERS.find(c => c.phone && normalizePhone(c.phone) === inputLast10);
    if (isSupabaseConfigured() && !profile) {
        try {
            const { data } = await supabase.from('customers').select('*').eq('phone', phone).single();
            if (data) { profile = data; CACHE_CUSTOMERS.push(data); }
        } catch (e) {}
    }
    let userRole = UserRole.CUSTOMER;
    let exists = !!profile;
    if (profile) userRole = profile.role || UserRole.CUSTOMER;
    else {
        let hasAdmin = CACHE_CUSTOMERS.some(c => c.role === UserRole.ADMIN);
        if (!hasAdmin && isSupabaseConfigured()) {
            try {
                const { data } = await supabase.from('customers').select('id').eq('role', 'ADMIN').limit(1);
                if (data && data.length > 0) hasAdmin = true;
            } catch (e) {}
        }
        if (!hasAdmin) userRole = UserRole.ADMIN;
    }
    return { exists, role: userRole, nextUserRole: userRole };
  },

  authenticate: async (phone: string, password?: string, isRegistering = false): Promise<User | null> => {
    const digitsOnly = phone.replace(/\D/g, '');
    const inputLast10 = normalizePhone(phone);
    const email = `${digitsOnly}@ledger.com`;
    const effectivePassword = password || 'customer-default-secret'; 
    if (!isSupabaseConfigured()) {
        let user = CACHE_CUSTOMERS.find(c => c.phone && normalizePhone(c.phone) === inputLast10);
        if (isRegistering) {
            const isFirstUser = !CACHE_CUSTOMERS.some(c => c.role === UserRole.ADMIN);
            const role = isFirstUser ? UserRole.ADMIN : UserRole.CUSTOMER;
            if (role === UserRole.CUSTOMER) throw new Error("Registration is disabled. Ask Admin to create account.");
            const newUser: Customer = { id: `u-${Date.now()}`, name: 'Admin', phone, address: 'Philippines', totalDebt: 0, avatarUrl: `https://ui-avatars.com/api/?name=Admin&background=random`, email, role, password: effectivePassword };
            CACHE_CUSTOMERS.push(newUser);
            saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
            return newUser as User;
        } else if (user) {
             if (user.role === UserRole.ADMIN && user.password && user.password !== password) throw new Error("Invalid Password");
             // Critical: Ensure password is part of the session user object
             return { ...user, role: user.role || UserRole.CUSTOMER, password: user.password };
        }
        return null;
    }
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
            // Critical: Ensure password is part of the session user object
            return { ...profile, password: effectivePassword } as User;
        }
    }
    if (isRegistering) throw new Error("Registration is disabled. Please ask the Admin to create your account.");
    else {
        try { await supabase.auth.signInWithPassword({ email, password: effectivePassword }); } catch (e) {}
        const { data: profile } = await supabase.from('customers').select('*').eq('phone', phone).single();
        if (!profile) return null;
        return { ...profile, password: effectivePassword } as User;
    }
  }
};

import { Customer, Product, Order, OrderStatus, DebtRecord, DebtStatus, User, UserRole, ReportSummary, SystemSettings, Language, RepaymentRecord } from '../types';
import { supabase, isSupabaseConfigured } from './supabaseClient';

// --- INITIAL STATE ---
// We start with empty data. The first user to login becomes Admin.

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

// Helper to persist to local storage (Fallback)
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

// Helper: Normalize phone to last 10 digits
const normalizePhone = (p: string) => (p || '').replace(/\D/g, '').slice(-10);

export const MockService = {
  // --- INITIALIZATION ---
  initialize: async () => {
      // 1. Load from Local Storage first
      CACHE_CUSTOMERS = loadLocal('LC_CUSTOMERS', DEFAULT_CUSTOMERS);
      CACHE_PRODUCTS = loadLocal('LC_PRODUCTS', DEFAULT_PRODUCTS);
      CACHE_ORDERS = loadLocal('LC_ORDERS', DEFAULT_ORDERS);
      CACHE_DEBTS = loadLocal('LC_DEBTS', DEFAULT_DEBTS);
      CACHE_REPAYMENTS = loadLocal('LC_REPAYMENTS', DEFAULT_REPAYMENTS);
      CACHE_SETTINGS = loadLocal('LC_SETTINGS', DEFAULT_SETTINGS);

      // Inject email for testing if missing in local data
      CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => ({
          ...c,
          email: c.email || `${c.name.replace(/\s/g, '').toLowerCase()}@example.com`
      }));

      if (!isSupabaseConfigured()) {
          console.log("Supabase not configured. Using Local Storage mode.");
          return;
      }

      try {
          // 2. Fetch from Supabase and update Cache
          // We intentionally select ALL customers regardless of Auth status
          const results = await Promise.allSettled([
              supabase.from('customers').select('*'),
              supabase.from('products').select('*'),
              supabase.from('orders').select('*'),
              supabase.from('debts').select('*'),
              supabase.from('repayments').select('*')
          ]);

          const [cust, prod, ord, debts, repays] = results;

          if (cust.status === 'fulfilled' && cust.value.data && cust.value.data.length > 0) CACHE_CUSTOMERS = cust.value.data as Customer[];
          if (prod.status === 'fulfilled' && prod.value.data && prod.value.data.length > 0) CACHE_PRODUCTS = prod.value.data as Product[];
          if (ord.status === 'fulfilled' && ord.value.data && ord.value.data.length > 0) CACHE_ORDERS = ord.value.data as Order[];
          if (debts.status === 'fulfilled' && debts.value.data && debts.value.data.length > 0) CACHE_DEBTS = debts.value.data as DebtRecord[];
          if (repays.status === 'fulfilled' && repays.value.data && repays.value.data.length > 0) CACHE_REPAYMENTS = repays.value.data as RepaymentRecord[];

          console.log("Data synced with Supabase");
      } catch (error) {
          console.error("Error syncing with Supabase:", error);
      }
  },

  // --- DATABASE HEALTH CHECK ---
  checkTableHealth: async () => {
      if (!isSupabaseConfigured()) return { connected: false, tables: {} };
      
      const tables = ['customers', 'products', 'orders', 'debts', 'repayments'];
      const status: Record<string, boolean> = {};
      
      for (const table of tables) {
          try {
              const { error } = await supabase.from(table).select('id').limit(1);
              if (error && error.code === '42P01') {
                  status[table] = false;
              } else {
                  status[table] = true;
              }
          } catch (e) {
              status[table] = false;
          }
      }
      
      return { connected: true, tables: status };
  },

  // --- READS ---
  getCustomers: (): Customer[] => CACHE_CUSTOMERS,
  getProducts: (): Product[] => CACHE_PRODUCTS,
  
  getOrders: (customerId?: string): Order[] => {
      let orders = customerId 
        ? CACHE_ORDERS.filter(o => o.customerId === customerId)
        : [...CACHE_ORDERS];

      return orders.sort((a, b) => {
          // Priority Sorting:
          // 0: PENDING (Needs Action)
          // 1: CONFIRMED (Unsettled/Debt)
          // 2: DELIVERING (Active)
          // 3: COMPLETED (Settled)
          // 4: CANCELLED (Settled)
          
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

          if (scoreA !== scoreB) {
              return scoreA - scoreB;
          }

          // Secondary sort: Date Descending
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  },

  getDebts: (customerId?: string): DebtRecord[] => {
      if (customerId) return CACHE_DEBTS.filter(d => d.customerId === customerId);
      return CACHE_DEBTS;
  },
  getRepayments: (customerId?: string): RepaymentRecord[] => {
      if (customerId) return CACHE_REPAYMENTS.filter(r => r.customerId === customerId).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return CACHE_REPAYMENTS.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },
  
  // NEW: Helper to find the last used debt category for a product/customer combination
  getLastUsedCategory: (customerId: string, productId: string): string | undefined => {
      // Scan debts (most recent first, as they are unshifted)
      const debts = CACHE_DEBTS.filter(d => d.customerId === customerId);
      for (const debt of debts) {
          const hasItem = debt.items.some(i => i.productId === productId);
          if (hasItem) return debt.category;
      }
      return undefined;
  },

  getSummary: (): ReportSummary => {
    // Dynamic Calculation
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Total Debt (Outstanding)
    const totalDebt = CACHE_DEBTS.reduce((acc, curr) => acc + (curr.amount - curr.paidAmount), 0);

    // Today's Debt Created
    const todayDebt = CACHE_DEBTS
        .filter(d => d.createdAt.startsWith(today))
        .reduce((acc, curr) => acc + curr.amount, 0);

    // Today's Income (Cash Sales + Repayments)
    const todayCashSales = CACHE_ORDERS
        .filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(today))
        .reduce((acc, curr) => acc + curr.totalAmount, 0);
    
    const todayRepayments = CACHE_REPAYMENTS
        .filter(r => r.timestamp.startsWith(today))
        .reduce((acc, curr) => acc + curr.amount, 0);
        
    const todayIncome = todayCashSales + todayRepayments;

    // Month Income
    const monthCashSales = CACHE_ORDERS
        .filter(o => o.status === OrderStatus.COMPLETED && o.createdAt.startsWith(currentMonth))
        .reduce((acc, curr) => acc + curr.totalAmount, 0);

    const monthRepayments = CACHE_REPAYMENTS
        .filter(r => r.timestamp.startsWith(currentMonth))
        .reduce((acc, curr) => acc + curr.amount, 0);

    return {
      todayDebt,
      todayIncome,
      monthIncome: monthCashSales + monthRepayments,
      totalDebt
    };
  },
  getSettings: () => CACHE_SETTINGS,

  // --- WRITES ---
  addCustomer: async (customer: Customer) => {
    CACHE_CUSTOMERS.push(customer);
    saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
    if (isSupabaseConfigured()) {
        await supabase.from('customers').insert(customer);
    }
    return customer;
  },

  updateCustomer: async (id: string, updates: Partial<Customer>) => {
    CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => c.id === id ? { ...c, ...updates } : c);
    saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
    if (isSupabaseConfigured()) {
        await supabase.from('customers').update(updates).eq('id', id);
    }
  },

  // NEW: Change Password (Supports Local & Supabase)
  changePassword: async (id: string, newPass: string) => {
      // 1. Update Local Cache
      CACHE_CUSTOMERS = CACHE_CUSTOMERS.map(c => c.id === id ? { ...c, password: newPass } : c);
      saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);

      // 2. Update Supabase (If configured)
      if (isSupabaseConfigured()) {
          const { error } = await supabase.auth.updateUser({ password: newPass });
          if (error) throw error;
      }
  },

  deleteCustomer: async (id: string) => {
    CACHE_CUSTOMERS = CACHE_CUSTOMERS.filter(c => c.id !== id);
    saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
    if (isSupabaseConfigured()) {
        await supabase.from('customers').delete().eq('id', id);
    }
  },

  addProduct: async (product: Product) => {
    CACHE_PRODUCTS.push(product);
    saveLocal('LC_PRODUCTS', CACHE_PRODUCTS);
    if (isSupabaseConfigured()) {
        await supabase.from('products').insert(product);
    }
    return product;
  },

  updateProduct: async (id: string, updates: Partial<Product>) => {
    CACHE_PRODUCTS = CACHE_PRODUCTS.map(p => p.id === id ? { ...p, ...updates } : p);
    saveLocal('LC_PRODUCTS', CACHE_PRODUCTS);
    if (isSupabaseConfigured()) {
        await supabase.from('products').update(updates).eq('id', id);
    }
  },

  deleteProduct: async (id: string) => {
    CACHE_PRODUCTS = CACHE_PRODUCTS.filter(p => p.id !== id);
    saveLocal('LC_PRODUCTS', CACHE_PRODUCTS);
    if (isSupabaseConfigured()) {
        await supabase.from('products').delete().eq('id', id);
    }
  },

  createOrder: async (order: Order) => {
    CACHE_ORDERS.unshift(order);
    saveLocal('LC_ORDERS', CACHE_ORDERS);
    if (isSupabaseConfigured()) {
        await supabase.from('orders').insert(order);
    }
    return order;
  },

  updateOrder: async (id: string, updates: Partial<Order>) => {
    const updatedAt = new Date().toISOString();
    CACHE_ORDERS = CACHE_ORDERS.map(o => o.id === id ? { ...o, ...updates, updatedAt } : o);
    saveLocal('LC_ORDERS', CACHE_ORDERS);
    if (isSupabaseConfigured()) {
        await supabase.from('orders').update({ ...updates, updatedAt }).eq('id', id);
    }
  },

  confirmOrder: async (orderId: string, categoryMap?: Record<string, string>) => {
    const order = CACHE_ORDERS.find(o => o.id === orderId);
    if (!order) return;
    
    // NEW: Update item categories if map provided
    if (categoryMap) {
        order.items = order.items.map(item => ({
            ...item,
            category: categoryMap[item.productId] || item.category
        }));
    }
    
    order.status = OrderStatus.CONFIRMED;
    order.updatedAt = new Date().toISOString();
    
    // Logic to split items by category and create debts
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
      if (isSupabaseConfigured()) {
          await supabase.from('customers').update({ totalDebt: customer.totalDebt }).eq('id', customer.id);
      }
    }

    saveLocal('LC_ORDERS', CACHE_ORDERS);
    saveLocal('LC_DEBTS', CACHE_DEBTS);
    saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);

    if (isSupabaseConfigured()) {
        // Update order status AND items (since categories might have changed)
        await supabase.from('orders').update({ 
            status: OrderStatus.CONFIRMED, 
            updatedAt: order.updatedAt,
            items: order.items // Ensure categories are updated in DB
        }).eq('id', orderId);

        if (newDebts.length > 0) {
            await supabase.from('debts').insert(newDebts);
        }
    }
  },

  processPOSTransaction: async (
      customerId: string, 
      items: {product: Product, qty: number}[], 
      isCash: boolean,
      categoryMap?: Record<string, string> // NEW: Optional map to override product default categories
  ) => {
      const customer = CACHE_CUSTOMERS.find(c => c.id === customerId);
      if (!customer) throw new Error("Customer not found");

      const totalAmount = items.reduce((sum, i) => sum + (i.product.price * i.qty), 0);
      const orderId = `ord-${Date.now()}`;

      const order: Order = {
          id: orderId,
          customerId: customer.id,
          customerName: customer.name,
          items: items.map(i => ({
              productId: i.product.id,
              productName: i.product.name,
              quantity: i.qty,
              price: i.product.price,
              category: categoryMap?.[i.product.id] || i.product.category // Use override if available
          })),
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
          const repay: RepaymentRecord = {
              id: `pay-pos-${Date.now()}`,
              customerId: customer.id,
              amount: totalAmount,
              category: 'POS Cash Sale',
              timestamp: new Date().toISOString(),
              method: 'CASH'
          };
          CACHE_REPAYMENTS.unshift(repay);
          newRepayments.push(repay);
      } else {
          customer.totalDebt += totalAmount;
      }

      // Update Stock (Local)
      items.forEach(item => {
          const product = CACHE_PRODUCTS.find(p => p.id === item.product.id);
          if (product) {
              product.stock = Math.max(0, product.stock - item.qty);
          }
      });

      saveLocal('LC_ORDERS', CACHE_ORDERS);
      saveLocal('LC_DEBTS', CACHE_DEBTS);
      saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
      saveLocal('LC_PRODUCTS', CACHE_PRODUCTS);
      saveLocal('LC_REPAYMENTS', CACHE_REPAYMENTS);

      if (isSupabaseConfigured()) {
          // Batch updates to Supabase
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
      if (isSupabaseConfigured()) {
          await supabase.from('customers').update({ totalDebt: customer.totalDebt }).eq('id', customer.id);
      }
    }
    saveLocal('LC_DEBTS', CACHE_DEBTS);
    
    if (isSupabaseConfigured()) {
        await supabase.from('debts').insert(debt);
    }
    return debt;
  },
  
  // NEW: Update Debt Category (for Drag & Drop)
  updateDebtCategory: async (debtId: string, newCategory: string) => {
      // Update Cache
      const debt = CACHE_DEBTS.find(d => d.id === debtId);
      if (debt) {
          debt.category = newCategory;
          // If items exist, ideally update their category too to keep data consistent
          if (debt.items) {
              debt.items.forEach(i => i.category = newCategory);
          }
          saveLocal('LC_DEBTS', CACHE_DEBTS);

          if (isSupabaseConfigured()) {
              await supabase.from('debts').update({ 
                  category: newCategory,
                  items: debt.items 
              }).eq('id', debtId);
          }
      }
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

          if (debt.paidAmount >= debt.amount) {
              debt.status = DebtStatus.PAID;
          } else {
              debt.status = DebtStatus.PARTIAL;
          }
          debtsToUpdate.push(debt);
      }

      const totalPaid = amount - remainingPayment;

      const customer = CACHE_CUSTOMERS.find(c => c.id === customerId);
      if(customer) {
          customer.totalDebt -= totalPaid;
      }

      let newRepayment: RepaymentRecord | null = null;
      if (totalPaid > 0) {
          newRepayment = {
              id: `pay-${Date.now()}`,
              customerId,
              amount: totalPaid,
              category,
              timestamp: new Date().toISOString(),
              method: 'CASH'
          };
          CACHE_REPAYMENTS.unshift(newRepayment);
      }

      saveLocal('LC_DEBTS', CACHE_DEBTS);
      saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
      saveLocal('LC_REPAYMENTS', CACHE_REPAYMENTS);

      if (isSupabaseConfigured()) {
          for(const d of debtsToUpdate) {
              await supabase.from('debts').update({ paidAmount: d.paidAmount, status: d.status }).eq('id', d.id);
          }
          if (customer) await supabase.from('customers').update({ totalDebt: customer.totalDebt }).eq('id', customer.id);
          if (newRepayment) await supabase.from('repayments').insert(newRepayment);
      }
  },

  updateSettings: (settings: Partial<SystemSettings>) => {
      CACHE_SETTINGS = { ...CACHE_SETTINGS, ...settings };
      saveLocal('LC_SETTINGS', CACHE_SETTINGS);
      return CACHE_SETTINGS;
  },

  // --- AUTHENTICATION SERVICE ---

  checkUserStatus: async (phone: string) => {
    const inputLast10 = normalizePhone(phone);
    
    // Check local cache first
    let profile = CACHE_CUSTOMERS.find(c => c.phone && normalizePhone(c.phone) === inputLast10);
    
    // Double check with Supabase if missing
    // IMPORTANT: For customers, we check the PUBLIC 'customers' table, not the auth table.
    // This allows customers to exist without full Supabase Auth accounts if needed.
    if (isSupabaseConfigured() && !profile) {
        try {
            const { data } = await supabase.from('customers').select('*').eq('phone', phone).single();
            if (data) {
                profile = data;
                CACHE_CUSTOMERS.push(data);
            }
        } catch (e) {
            console.warn("Supabase check failed or user not found:", e);
        }
    }

    let userRole = UserRole.CUSTOMER;
    let exists = false;

    if (profile) {
        exists = true;
        userRole = profile.role || UserRole.CUSTOMER;
    } else {
        // Decide if this new user should be ADMIN
        // 1. Check cache
        let hasAdmin = CACHE_CUSTOMERS.some(c => c.role === UserRole.ADMIN);
        
        // 2. If no admin in cache and Supabase is on, check DB to be safe
        if (!hasAdmin && isSupabaseConfigured()) {
            try {
                const { data } = await supabase.from('customers').select('id').eq('role', 'ADMIN').limit(1);
                if (data && data.length > 0) {
                    hasAdmin = true;
                }
            } catch (e) {
                console.warn("Failed to check admin existence in DB", e);
            }
        }
        
        if (!hasAdmin) userRole = UserRole.ADMIN;
    }

    return {
      exists,
      role: userRole,
      nextUserRole: userRole 
    };
  },

  authenticate: async (phone: string, password?: string, isRegistering = false): Promise<User | null> => {
    const digitsOnly = phone.replace(/\D/g, '');
    const inputLast10 = normalizePhone(phone);
    const email = `${digitsOnly}@ledger.com`;
    // Hardcoded default password for customers to allow "Captcha Only" login
    const effectivePassword = password || 'customer-default-secret'; 
    
    // --- MODE 1: OFFLINE / LOCAL ---
    if (!isSupabaseConfigured()) {
        let user = CACHE_CUSTOMERS.find(c => c.phone && normalizePhone(c.phone) === inputLast10);

        if (isRegistering) {
            const isFirstUser = !CACHE_CUSTOMERS.some(c => c.role === UserRole.ADMIN);
            const role = isFirstUser ? UserRole.ADMIN : UserRole.CUSTOMER;
            // Admin Bootstrap only
            if (role === UserRole.CUSTOMER) {
                 throw new Error("Registration is disabled. Ask Admin to create account.");
            }

            const newUser: Customer = {
                id: `u-${Date.now()}`,
                name: 'Admin',
                phone: phone, 
                address: 'Philippines',
                totalDebt: 0,
                avatarUrl: `https://ui-avatars.com/api/?name=Admin&background=random`,
                email: email,
                role: role,
                password: effectivePassword
            };
            CACHE_CUSTOMERS.push(newUser);
            saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
            return newUser as User;
        } else if (user) {
             if (user.role === UserRole.ADMIN && user.password && user.password !== password) throw new Error("Invalid Password");
             return { ...user, role: user.role || UserRole.CUSTOMER };
        }
        return null;
    }

    // --- MODE 2: SUPABASE ---
    const { role: targetRole } = await MockService.checkUserStatus(phone);

    // ADMIN AUTH: Must use real Supabase Auth
    if (targetRole === UserRole.ADMIN) {
        if (isRegistering) {
            const { data, error } = await supabase.auth.signUp({ email, password: effectivePassword });
            if (error) throw error;
            if (!data.user) throw new Error("Registration failed");
            
            // Create Profile
            const newUser: Customer = {
                id: data.user.id,
                name: 'Admin',
                phone,
                address: 'Philippines',
                totalDebt: 0,
                avatarUrl: `https://ui-avatars.com/api/?name=Admin&background=random`,
                email,
                role: UserRole.ADMIN
            };
            await supabase.from('customers').insert(newUser);
            CACHE_CUSTOMERS.push(newUser);
            return newUser as User;
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password: effectivePassword });
            if (error) throw error;
            // Fetch Profile
            const { data: profile } = await supabase.from('customers').select('*').eq('id', data.user?.id).single();
            if (!profile) throw new Error("Admin profile not found");
            return profile as User;
        }
    }

    // CUSTOMER AUTH: Hybrid "Soft Login"
    if (isRegistering) {
        // Enforce: Customers cannot self-register.
        throw new Error("Registration is disabled. Please ask the Admin to create your account.");
    } else {
        // LOGIN
        // 1. Try Auth Login (Silent try)
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password: effectivePassword });
        } catch (e) {}

        // 2. Check Public Table
        const { data: profile } = await supabase.from('customers').select('*').eq('phone', phone).single();
        
        if (!profile) {
            throw new Error("Account not found. Please register.");
        }
        
        return profile as User;
    }
  },

  getBackupData: () => {
      return {
          customers: CACHE_CUSTOMERS,
          products: CACHE_PRODUCTS,
          orders: CACHE_ORDERS,
          debts: CACHE_DEBTS,
          repayments: CACHE_REPAYMENTS,
          settings: CACHE_SETTINGS,
          version: '1.0',
          timestamp: new Date().toISOString()
      };
  },

  restoreBackupData: (data: any) => {
      if (!data || !data.version) throw new Error("Invalid backup file");
      
      CACHE_CUSTOMERS = data.customers || [];
      CACHE_PRODUCTS = data.products || [];
      CACHE_ORDERS = data.orders || [];
      CACHE_DEBTS = data.debts || [];
      CACHE_REPAYMENTS = data.repayments || [];
      CACHE_SETTINGS = data.settings || DEFAULT_SETTINGS;

      saveLocal('LC_CUSTOMERS', CACHE_CUSTOMERS);
      saveLocal('LC_PRODUCTS', CACHE_PRODUCTS);
      saveLocal('LC_ORDERS', CACHE_ORDERS);
      saveLocal('LC_DEBTS', CACHE_DEBTS);
      saveLocal('LC_REPAYMENTS', CACHE_REPAYMENTS);
      saveLocal('LC_SETTINGS', CACHE_SETTINGS);
  },

  factoryReset: () => {
      localStorage.removeItem('LC_CUSTOMERS');
      localStorage.removeItem('LC_PRODUCTS');
      localStorage.removeItem('LC_ORDERS');
      localStorage.removeItem('LC_DEBTS');
      localStorage.removeItem('LC_REPAYMENTS');
      localStorage.removeItem('LC_SETTINGS');
      localStorage.removeItem('LC_LAST_REMINDER_DATE');
      window.location.reload();
  }
};

export enum UserRole {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  DELIVERING = 'DELIVERING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum DebtStatus {
  UNPAID = 'UNPAID',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID'
}

export interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  email?: string;
  password?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  avatarUrl: string;
  totalDebt: number;
  email?: string;
  // Auth fields
  role?: UserRole;
  password?: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number; // Added for profit analysis
  stock: number;
  imageUrl: string;
  description?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  category: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string; // ISO Date
  updatedAt: string;
}

export interface DebtRecord {
  id: string;
  customerId: string;
  orderId?: string; // Optional if manual entry
  amount: number;
  paidAmount: number;
  items: OrderItem[];
  category: string; // Grouping by category
  createdAt: string;
  status: DebtStatus;
  notes?: string;
}

export interface RepaymentRecord {
  id: string;
  customerId: string;
  amount: number;
  category: string;
  timestamp: string;
  method?: 'CASH' | 'ONLINE';
}

export interface ReportSummary {
  todayDebt: number;
  todayIncome: number;
  totalDebt: number;
  monthIncome: number;
}

export interface SystemSettings {
  language: Language;
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    push: boolean;
    emailOnDebt: boolean;
    emailOnPayment: boolean;
    emailOnDeletion: boolean;
  };
  backupEmail: string;
}

export enum Language {
  EN = 'EN',
  CN = 'CN'
}

export interface Translation {
  dashboard: string;
  customers: string;
  products: string;
  orders: string;
  debts: string;
  reports: string;
  settings: string;
  logout: string;
  welcome: string;
  total_customers: string;
  total_products: string;
  pending_orders: string;
  total_debt: string;
  login_title: string;
  login_btn: string;
  phone_placeholder: string;
  my_dashboard: string;
  my_orders: string;
  my_debts: string;
  shop: string;
  profile: string;
  register_link: string;
  login_link: string;
  send_code: string;
  verify_login: string;
  pos_mode: string;
  inventory_mode: string;
  checkout: string;
  payment_method: string;
  cash: string;
  credit: string;
}

export const DICTIONARY: Record<Language, Translation> = {
  [Language.EN]: {
    dashboard: "Dashboard",
    customers: "Customers",
    products: "Products",
    orders: "Orders",
    debts: "Debt Ledger",
    reports: "Reports",
    settings: "System Settings",
    logout: "Logout",
    welcome: "Welcome back",
    total_customers: "Total Customers",
    total_products: "Total Products",
    pending_orders: "Pending Orders",
    total_debt: "Total Outstanding",
    login_title: "Ledger Connect",
    login_btn: "Sign In",
    phone_placeholder: "917 123 4567",
    my_dashboard: "My Dashboard",
    my_orders: "My Orders",
    my_debts: "My Debts",
    shop: "Shop",
    profile: "Profile",
    register_link: "New Merchant? Create Account",
    login_link: "Already have an account? Sign In",
    send_code: "Continue",
    verify_login: "Login",
    pos_mode: "POS Terminal",
    inventory_mode: "Manage Inventory",
    checkout: "Checkout",
    payment_method: "Payment Method",
    cash: "Cash (Paid)",
    credit: "Credit (Debt)"
  },
  [Language.CN]: {
    dashboard: "仪表盘",
    customers: "客户管理",
    products: "产品管理",
    orders: "订单管理",
    debts: "欠款记录",
    reports: "财务报表",
    settings: "系统设置",
    logout: "退出登录",
    welcome: "欢迎回来",
    total_customers: "客户总数",
    total_products: "产品总数",
    pending_orders: "待处理订单",
    total_debt: "总欠款",
    login_title: "账客通",
    login_btn: "登录",
    phone_placeholder: "917 123 4567",
    my_dashboard: "我的概览",
    my_orders: "我的订单",
    my_debts: "我的欠款",
    shop: "商城",
    profile: "个人资料",
    register_link: "新商户？创建账户",
    login_link: "已有账户？登录",
    send_code: "继续",
    verify_login: "登录",
    pos_mode: "销售终端 (POS)",
    inventory_mode: "库存管理",
    checkout: "结账",
    payment_method: "付款方式",
    cash: "现金支付 (已付)",
    credit: "赊账 (欠款)"
  }
};
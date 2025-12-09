# 账客通 (Ledger Connect) - Project Specification

## 1. Project Overview

**Ledger Connect** is a professional accounts receivable and inventory management system designed for individual merchants, small shop owners (e.g., Sari-sari stores), and freelancers. It serves as a digital ledger to track debts ("utang"), manage product inventory, process point-of-sale (POS) transactions, and generate financial reports.

The application is built as a Progressive Web App (PWA) capable of running offline (using LocalStorage) and syncing with the cloud (Supabase) when online.

---

## 2. Technology Stack

*   **Frontend Framework**: React 18 with TypeScript.
*   **Styling**: Tailwind CSS (with Dark Mode support).
*   **Icons**: Lucide React.
*   **Charts**: Recharts.
*   **Backend / Database**: Supabase (PostgreSQL + Auth).
*   **State Management**: React Context + Custom Services (MockService acting as a Data Access Layer).
*   **Monetization**: Adsterra Iframe Integration.
*   **Build Tooling**: Vite (ES Modules).

---

## 3. Core Features & Modules

### 3.1. Authentication & Roles
*   **Phone Number Login**: Primary authentication method.
*   **Roles**:
    *   **Admin (Merchant)**: Full access to inventory, customer management, and ledger.
    *   **Customer**: Read-only access to their own dashboard, order history, and debt status.
*   **Security**: Captcha-based login simulation for customers; Password authentication for Admins via Supabase Auth.

### 3.2. Dashboard
*   **Statistics**: Real-time view of Total Outstanding Debt, Total Customers, Pending Orders, and Product Count.
*   **Financial Charting**: 7-Day Income vs. Debt creation analysis using Area Charts.
*   **Activity Feed**: Recent transactions and debt records.

### 3.3. Customer Management
*   **CRUD**: Create, Read, Update, Delete customer profiles.
*   **Debt Indicators**: Visual badges indicating if a customer is in "Good Standing" or has "Debt".
*   **History**: Comprehensive transaction history view combining Orders, Payments, and Manual Debt adjustments.
*   **Communication**: Shortcuts for SMS/Call reminders.

### 3.4. Product & Inventory (POS)
*   **Inventory Mode**: Manage stock levels, cost prices, and selling prices. Low stock indicators (< 20 units).
*   **POS Mode**:
    *   **Cart System**: Add items to a shopping cart.
    *   **Checkout**: Support for **Cash** (Paid immediately) or **Credit** (Recorded as Debt).
    *   **Category Assignment**: When charging to credit, items can be categorized (e.g., "Groceries", "Loans") for granular ledger tracking.

### 3.5. Order Management
*   **Workflow**: Pending -> Confirmed -> Delivering -> Completed (or Cancelled).
*   **Debt Integration**: When an order is confirmed as "Credit", it automatically generates a Debt Record in the ledger.
*   **Receipts**: Thermal-printer friendly receipt layout.

### 3.6. Debt Ledger (The Core)
*   **Categorized Tracking**: Debts are grouped by category (e.g., "Store Credit", "Rice Loan").
*   **Historical Filtering**: Calculate outstanding balances based on specific dates (Balance Forward logic).
*   **Repayment**: Record partial or full payments against specific debt categories.
*   **Statement of Account (SOA)**: Generate and download text-based SOA reports for customers.
*   **Ledger Logic**: Uses a double-entry style logic visualization (Debit = Debt, Credit = Payment).

### 3.7. Settings & Data
*   **Localization**: English and Chinese (CN) language support.
*   **Theme**: Light and Dark mode toggle.
*   **Data Management**:
    *   **JSON Backup/Restore**: Full export/import of local data.
    *   **CSV Import**: Bulk import for Customers and Products.
    *   **Factory Reset**: Wipes local storage.
*   **Database Config**: Connection status check for Supabase.

---

## 4. Data Model (Schema)

The application uses a relational schema compatible with PostgreSQL (Supabase).

### Customers
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID/String | Primary Key |
| `name` | String | Full Name |
| `phone` | String | Unique mobile number |
| `totalDebt` | Numeric | Cached total outstanding balance |
| `role` | Enum | 'ADMIN' or 'CUSTOMER' |

### Products
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID/String | Primary Key |
| `name` | String | Product Name |
| `category` | String | Grouping (e.g., Grains, Canned) |
| `price` | Numeric | Selling Price (SRP) |
| `cost` | Numeric | Cost Price (Capital) |
| `stock` | Integer | Inventory Level |

### Orders
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID/String | Primary Key |
| `customerId` | String | Foreign Key to Customers |
| `items` | JSONB | Array of product snapshots |
| `status` | Enum | PENDING, CONFIRMED, COMPLETED, etc. |
| `totalAmount`| Numeric | Total value of order |

### Debts (Ledger)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID/String | Primary Key |
| `customerId` | String | Foreign Key to Customers |
| `amount` | Numeric | Original Debt Amount |
| `paidAmount` | Numeric | Amount Repaid so far |
| `category` | String | Logic grouping for repayment |
| `status` | Enum | UNPAID, PARTIAL, PAID |
| `createdAt` | Timestamp| Date of transaction |

### Repayments
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID/String | Primary Key |
| `amount` | Numeric | Payment Amount |
| `category` | String | Which debt category was paid |
| `timestamp` | Timestamp| Date of payment |

---

## 5. Setup & Configuration

### 5.1. Local Storage Mode (Default)
The app works out-of-the-box using `localStorage`. No server setup is required for basic testing. Data persists in the browser.

### 5.2. Supabase Integration
To enable cloud sync:
1.  Create a Supabase Project.
2.  Run the SQL script provided in the **Settings > Database** tab of the application.
3.  Update `config.ts` with your `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

### 5.3. Adsterra
To enable ads:
1.  Update `config.ts` with `ADSTERRA.ENABLED = true` and provide your `KEY`.

---

## 6. Business Logic Notes

1.  **Date Filtering**: The Debt page uses strict local date comparison. If a user selects a date filter, the "Outstanding Balance" header recalculates to show the balance *as of* that date, serving as a historical snapshot.
2.  **Inventory Deduction**: Stock is deducted locally immediately upon POS checkout or Order Confirmation.
3.  **Credit vs Cash**:
    *   **Cash**: Creates an Order (Completed) and a Repayment record immediately.
    *   **Credit**: Creates an Order (Confirmed) and a Debt Record.


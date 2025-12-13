# Ledger Connect (账客通) - Installation Guide

This guide will help you set up **Ledger Connect** on your local machine for development or deployment.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js** (v18.0.0 or higher)
*   **npm** (usually comes with Node.js) or **yarn**
*   **Git**

## 🚀 Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/ledger-connect.git
cd ledger-connect
```

### 2. Install Dependencies

This project uses React, TypeScript, and Vite. Install the required packages:

```bash
npm install
```

**Core Dependencies:**
*   `react`, `react-dom`
*   `react-router-dom` (Routing)
*   `lucide-react` (Icons)
*   `recharts` (Charts)
*   `@supabase/supabase-js` (Database & Auth)

**Dev Dependencies:**
*   `vite`
*   `typescript`
*   `@vitejs/plugin-react`
*   `tailwindcss` (Included via CDN in development, but recommended for build optimization)

### 3. Database Setup (Supabase)

This application uses **Supabase** for the backend database and authentication.

1.  **Create a Project**: Go to [Supabase](https://supabase.com/) and create a new project.
2.  **SQL Setup**:
    *   Go to the **SQL Editor** in your Supabase dashboard.
    *   Copy the SQL script located in the app under **Settings > Database > Setup Required**.
    *   Alternatively, use the SQL script provided below:

    <details>
    <summary>Click to view SQL Script</summary>

    ```sql
    -- Enable UUID extension
    create extension if not exists "uuid-ossp";

    -- Customers Table
    create table if not exists public.customers (
      id text primary key,
      name text not null,
      phone text,
      address text,
      "avatarUrl" text,
      "totalDebt" numeric default 0,
      role text default 'CUSTOMER',
      email text,
      password text,
      created_at timestamptz default now()
    );

    -- Products Table
    create table if not exists public.products (
      id text primary key,
      name text not null,
      category text,
      price numeric default 0,
      cost numeric default 0,
      stock integer default 0,
      "imageUrl" text,
      description text,
      created_at timestamptz default now()
    );

    -- Orders Table
    create table if not exists public.orders (
      id text primary key,
      "customerId" text references public.customers(id),
      "customerName" text,
      items jsonb,
      "totalAmount" numeric,
      status text,
      "createdAt" timestamptz default now(),
      "updatedAt" timestamptz default now()
    );

    -- Debts Table
    create table if not exists public.debts (
      id text primary key,
      "customerId" text references public.customers(id),
      "orderId" text,
      amount numeric,
      "paidAmount" numeric default 0,
      items jsonb,
      category text,
      "createdAt" timestamptz default now(),
      status text,
      notes text
    );

    -- Repayments Table
    create table if not exists public.repayments (
      id text primary key,
      "customerId" text references public.customers(id),
      amount numeric,
      category text,
      timestamp timestamptz default now(),
      method text
    );

    -- Enable RLS (Row Level Security) - Optional but Recommended
    alter table public.customers enable row level security;
    alter table public.products enable row level security;
    alter table public.orders enable row level security;
    alter table public.debts enable row level security;
    alter table public.repayments enable row level security;

    -- Create Public Policies (For Demo/Dev Mode)
    create policy "Public Access Customers" on public.customers for all using (true);
    create policy "Public Access Products" on public.products for all using (true);
    create policy "Public Access Orders" on public.orders for all using (true);
    create policy "Public Access Debts" on public.debts for all using (true);
    create policy "Public Access Repayments" on public.repayments for all using (true);
    ```
    </details>

3.  **Auth Settings**:
    *   Go to **Authentication > Providers > Email**.
    *   **Disable** "Confirm email". (This app uses phone numbers as pseudo-IDs and email for data, skipping the verification loop for simplicity).

### 4. Configuration

Update the application config with your Supabase credentials.

1.  Open `config.ts` in the project root.
2.  Update the `SUPABASE` section:

```typescript
export const CONFIG = {
  SUPABASE: {
    // Found in Supabase Dashboard -> Settings -> API
    URL: 'https://your-project-id.supabase.co', 
    ANON_KEY: 'your-public-anon-key'
  },
  // ...
};
```

### 5. Running the Application

Start the development server:

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

## 🛠️ Offline Mode

If you do not configure Supabase, the application will default to **Offline Mode**.
*   Data is stored in the browser's `LocalStorage`.
*   Data will not sync across devices.
*   Clearing browser cache will lose data.

## 📱 Mobile Support

This app is designed as a **PWA (Progressive Web App)**.
*   It looks and feels like a native app on mobile.
*   Open the URL on your mobile browser (Chrome/Safari) and select "Add to Home Screen" to install.

## ⚠️ Troubleshooting

*   **Database Connection Failed**: Ensure `config.ts` has the correct URL/Key and you have run the SQL setup script.
*   **Login Issues**: If using Supabase, ensure "Confirm Email" is disabled. If stuck, go to Settings -> Data & Backup -> Factory Reset.
*   **Print Not Working**: Ensure pop-ups are allowed for the print dialog window.

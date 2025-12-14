// Follow this setup guide to integrate the Deno runtime
// https://supabase.com/docs/guides/functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Declare Deno global for TypeScript support in non-Deno environments
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TimelineItem {
  timestamp: string;
  customerName: string;
  type: 'DEBT' | 'PAYMENT';
  description: string;
  amount: number;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Determine Time Range (Today in PH Time UTC+8)
    // Adjust logic if server is UTC. Here we assume we want "Today" based on server time.
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(now.setHours(23, 59, 59, 999)).toISOString();
    const dateStr = now.toLocaleDateString();

    // 3. Fetch Admin Email
    const { data: admins } = await supabaseClient
      .from('customers')
      .select('email')
      .eq('role', 'ADMIN')
      .limit(1);
    
    const adminEmail = admins && admins.length > 0 ? admins[0].email : null;

    if (!adminEmail) {
        throw new Error("No Admin email found to send report to.");
    }

    // 4. Fetch Today's Activity
    // A. Debts
    const { data: debts } = await supabaseClient
        .from('debts')
        .select(`
            amount, category, createdAt, 
            customers (name)
        `)
        .gte('createdAt', startOfDay)
        .lte('createdAt', endOfDay);

    // B. Repayments
    const { data: payments } = await supabaseClient
        .from('repayments')
        .select(`
            amount, category, timestamp,
            customers (name)
        `)
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay);

    // C. All Customers (For Debt Summary)
    const { data: allCustomers } = await supabaseClient
        .from('customers')
        .select('name, totalDebt, phone')
        .gt('totalDebt', 0)
        .order('totalDebt', { ascending: false });

    // 5. Construct Timeline
    const timeline: TimelineItem[] = [];

    debts?.forEach((d: any) => {
        timeline.push({
            timestamp: d.createdAt,
            customerName: d.customers?.name || 'Unknown',
            type: 'DEBT',
            description: `Added Debt (${d.category})`,
            amount: d.amount
        });
    });

    payments?.forEach((p: any) => {
        timeline.push({
            timestamp: p.timestamp,
            customerName: p.customers?.name || 'Unknown',
            type: 'PAYMENT',
            description: `Repayment (${p.category})`,
            amount: p.amount
        });
    });

    // Sort by Time Ascending
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 6. Format Content ("SMS Style with Time on Left")
    let reportBody = `DAILY LEDGER REPORT\nDate: ${dateStr}\n\n`;
    
    reportBody += `--- TIMELINE ---\n`;
    if (timeline.length === 0) {
        reportBody += `No activity recorded today.\n`;
    } else {
        timeline.forEach(item => {
            // Format time: 09:30 AM
            const timePart = new Date(item.timestamp).toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: true,
                timeZone: 'Asia/Manila' // Adjust Timezone as needed
            });
            
            const sign = item.type === 'DEBT' ? '+' : '-';
            // Output: 06:15 PM - Juan Cruz: Added Debt (Rice) - P500
            reportBody += `${timePart} - ${item.customerName}: ${item.description} - ${sign}P${item.amount}\n`;
        });
    }

    reportBody += `\n--- OUTSTANDING DEBTS (ALL CUSTOMERS) ---\n`;
    if (!allCustomers || allCustomers.length === 0) {
        reportBody += `No outstanding debts.\n`;
    } else {
        allCustomers.forEach((c: any) => {
            reportBody += `${c.name}: P${c.totalDebt.toLocaleString()}\n`;
        });
    }

    // 7. Send Email
    // NOTE: This uses a mock console log. To send real email, use Resend/SendGrid.
    // Example with Resend:
    /*
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`
      },
      body: JSON.stringify({
        from: 'Ledger Connect <system@yourdomain.com>',
        to: [adminEmail],
        subject: `Daily Ledger Report - ${dateStr}`,
        text: reportBody
      })
    })
    */

    console.log("SENDING EMAIL TO:", adminEmail);
    console.log("SUBJECT:", `Daily Ledger Report - ${dateStr}`);
    console.log("BODY:\n", reportBody);

    // 8. Return Response
    return new Response(JSON.stringify({ 
        success: true, 
        message: 'Report generated',
        recipient: adminEmail,
        preview: reportBody
    }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

/**
 * --- HOW TO SCHEDULE THIS (CRON JOB) ---
 * 
 * 1. Go to Supabase Dashboard -> SQL Editor.
 * 2. Enable the pg_cron extension:
 *    create extension if not exists pg_cron;
 * 
 * 3. Schedule the function to run every day at 6 PM (Asia/Manila time is UTC+8, so 6PM is 10:00 UTC).
 *    Note: Cron runs in UTC. 18:00 Manila = 10:00 UTC.
 * 
 *    select cron.schedule(
 *      'daily-admin-report',           -- name of the cron job
 *      '0 10 * * *',                   -- every day at 10:00 UTC (6:00 PM PH Time)
 *      $$
 *      select
 *        net.http_post(
 *            url:='https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/daily-admin-report',
 *            headers:='{"Content-Type": "application/json", "Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>"}'::jsonb,
 *            body:='{}'::jsonb
 *        ) as request_id;
 *      $$
 *    );
 */

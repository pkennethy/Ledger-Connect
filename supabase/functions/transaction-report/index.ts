
// Supabase Edge Function (Deno)
// Deploy using: supabase functions deploy transaction-report

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Declare Deno global for TypeScript support in non-Deno environments
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { customerId, txnType, amount, category } = await req.json()

    // 1. Initialize Supabase Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Fetch Admin Email
    const { data: admins } = await supabaseClient
      .from('customers')
      .select('email')
      .eq('role', 'ADMIN')
      .limit(1)
    
    const adminEmail = admins?.[0]?.email

    if (!adminEmail) {
        throw new Error("Admin email not configured in database.")
    }

    // 3. Fetch Customer and Updated Balance
    const { data: customer } = await supabaseClient
      .from('customers')
      .select('name, totalDebt')
      .eq('id', customerId)
      .single()

    if (!customer) throw new Error("Customer not found")

    // 4. Format Email
    const dateStr = new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
    const sign = txnType === 'DEBT' ? '+' : (txnType === 'REPAYMENT' ? '-' : 'MOD')
    
    const emailSubject = `Transaction Alert: ${customer.name} (${txnType})`
    const emailBody = `
STATEMENT OF BALANCE - TRANSACTION REPORT
Date: ${dateStr}

--- TRANSACTION DETAILS ---
Customer: ${customer.name}
Type: ${txnType}
Category: ${category}
Amount: ${sign}P${amount.toLocaleString()}

--- UPDATED STATUS ---
New Outstanding Balance: P${customer.totalDebt.toLocaleString()}

This is an automated notification from Ledger Connect.
    `.trim()

    // 5. Send Email
    // NOTE: Replace this with your actual Resend or SendGrid API logic.
    // Example with Resend:
    /*
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`
      },
      body: JSON.stringify({
        from: 'Ledger Connect <notifications@yourdomain.com>',
        to: [adminEmail],
        subject: emailSubject,
        text: emailBody
      })
    })
    */

    console.log(`[EMAIL LOG] To: ${adminEmail} | Subject: ${emailSubject}`)
    console.log(emailBody)

    return new Response(JSON.stringify({ success: true, message: 'Notification processed' }), {
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

// NOTE: This file is a Supabase Edge Function (Deno). 
// It uses URL imports which may cause build errors in the frontend React environment.
// UNCOMMENT the code below when deploying to Supabase via CLI.

/*
// Follow this setup guide to integrate the Deno runtime
// https://supabase.com/docs/guides/functions

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Declare Deno global for TypeScript support in non-Deno environments
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase Client with Service Role Key (Admin Access)
    // These environment variables are automatically available in Supabase Edge Functions
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Query all customers with outstanding debt (totalDebt > 0)
    // We only select necessary fields to save bandwidth
    const { data: debtors, error } = await supabaseClient
      .from('customers')
      .select('id, name, email, phone, totalDebt')
      .gt('totalDebt', 0)

    if (error) {
        throw new Error(`Database Error: ${error.message}`)
    }

    if (!debtors || debtors.length === 0) {
        return new Response(JSON.stringify({ 
            success: true, 
            message: 'No debtors found today. No emails sent.' 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })
    }

    // 2. Process and "Send" Emails
    // Note: In a real production app, integrate 'resend', 'sendgrid', or 'nodemailer' here.
    const results = []
    
    for (const customer of debtors) {
        // Skip if no email
        if (!customer.email || !customer.email.includes('@')) {
            console.log(`Skipping ${customer.name}: Invalid email`)
            continue
        }

        // --- EMAIL SENDING LOGIC (MOCKED) ---
        // Replace this block with your actual email provider API call
        console.log(`[Mock Email] To: ${customer.email}`)
        console.log(`[Subject] Payment Reminder: ₱${customer.totalDebt} Outstanding`)
        console.log(`[Body] Dear ${customer.name}, this is a friendly reminder...`)
        // ------------------------------------

        results.push({
            customer: customer.name,
            email: customer.email,
            amount: customer.totalDebt,
            status: 'sent'
        })
    }

    // 3. Return Summary
    return new Response(JSON.stringify({ 
        success: true, 
        message: `Processed reminders for ${debtors.length} customers.`,
        sent_count: results.length,
        details: results 
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
*/
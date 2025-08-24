// Supabase Edge Function for handling Stripe webhooks
// Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@11.1.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (req) => {
  // CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Skip auth check for webhooks - Stripe uses signature verification instead
  const signature = req.headers.get('Stripe-Signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  
  if (!signature || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'Webhook signature missing' }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.text()
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })

    console.log(`Processing webhook event: ${event.type}`)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('Checkout session completed:', session.id)
        
        if (session.customer_email && session.subscription) {
          const trialEnd = new Date()
          trialEnd.setDate(trialEnd.getDate() + 7)
          
          const { error } = await supabase.rpc('update_user_pro_status_by_email', {
            p_user_email: session.customer_email,
            p_stripe_customer_id: session.customer as string,
            p_stripe_subscription_id: session.subscription as string,
            p_status: 'trialing',
            p_trial_ends_at: trialEnd.toISOString()
          })
          
          if (error) {
            console.error('RPC error:', error)
          }
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customer = await stripe.customers.retrieve(subscription.customer as string)
        
        if ('email' in customer && customer.email) {
          const { error } = await supabase.rpc('update_user_pro_status_by_email', {
            p_user_email: customer.email,
            p_stripe_customer_id: customer.id,
            p_stripe_subscription_id: subscription.id,
            p_status: subscription.status,
            p_trial_ends_at: null
          })
          
          if (error) {
            console.error('RPC error:', error)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customer = await stripe.customers.retrieve(subscription.customer as string)
        
        if ('email' in customer && customer.email) {
          const { error } = await supabase.rpc('update_user_pro_status_by_email', {
            p_user_email: customer.email,
            p_stripe_customer_id: customer.id,
            p_stripe_subscription_id: subscription.id,
            p_status: 'canceled',
            p_trial_ends_at: null
          })
          
          if (error) {
            console.error('RPC error:', error)
          }
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customer = await stripe.customers.retrieve(invoice.customer as string)
        
        if ('email' in customer && customer.email && invoice.subscription) {
          const { error } = await supabase.rpc('update_user_pro_status_by_email', {
            p_user_email: customer.email,
            p_stripe_customer_id: customer.id,
            p_stripe_subscription_id: invoice.subscription as string,
            p_status: 'active',
            p_trial_ends_at: null
          })
          
          if (error) {
            console.error('RPC error:', error)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customer = await stripe.customers.retrieve(invoice.customer as string)
        
        if ('email' in customer && customer.email && invoice.subscription) {
          const { error } = await supabase.rpc('update_user_pro_status_by_email', {
            p_user_email: customer.email,
            p_stripe_customer_id: customer.id,
            p_stripe_subscription_id: invoice.subscription as string,
            p_status: 'past_due',
            p_trial_ends_at: null
          })
          
          if (error) {
            console.error('RPC error:', error)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // ALWAYS return success to Stripe
    return new Response(JSON.stringify({ received: true }), {
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200,
    })
  } catch (err) {
    console.error('Webhook error:', err)
    
    // Return error to Stripe for retry
    return new Response(
      JSON.stringify({ error: err.message }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400 
      }
    )
  }
})
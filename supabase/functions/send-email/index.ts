// Supabase Edge Function for sending email notifications
// Handles new backlink alerts, weekly digests, and competitor scanning notifications

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  type: 'new_backlinks' | 'weekly_digest' | 'competitor_alert' | 'health_check_summary'
  to: string
  user_id: string
  data: any
}

interface BacklinkData {
  source_url: string
  source_domain: string
  target_url: string
  anchor_text: string
  context_type: string
  found_at: string
}

interface WeeklyDigestData {
  new_backlinks: number
  total_backlinks: number
  broken_links: number
  top_domains: string[]
  keywords_discovered: number
  period: { start: string; end: string }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request
    const { type, to, user_id, data }: EmailRequest = await req.json()

    // Verify user exists and has email notifications enabled
    const { data: user, error: userError } = await supabase
      .schema('forgerank')
      .from('users')
      .select('email, is_pro, email_notifications_enabled')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!user.email_notifications_enabled) {
      return new Response(
        JSON.stringify({ message: 'Email notifications disabled for user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate email content based on type
    let subject: string
    let htmlContent: string
    let textContent: string

    switch (type) {
      case 'new_backlinks':
        ({ subject, htmlContent, textContent } = generateNewBacklinksEmail(data))
        break
      case 'weekly_digest':
        ({ subject, htmlContent, textContent } = generateWeeklyDigestEmail(data))
        break
      case 'competitor_alert':
        ({ subject, htmlContent, textContent } = generateCompetitorAlertEmail(data))
        break
      case 'health_check_summary':
        ({ subject, htmlContent, textContent } = generateHealthCheckSummaryEmail(data))
        break
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid email type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    // Send email using Resend (you can replace with your preferred service)
    const emailResponse = await sendEmail({
      to,
      subject,
      htmlContent,
      textContent
    })

    if (!emailResponse.success) {
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailResponse.error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log email sent
    await supabase
      .schema('forgerank')
      .from('email_logs')
      .insert({
        user_id,
        email_type: type,
        recipient: to,
        subject,
        sent_at: new Date().toISOString(),
        status: 'sent'
      })

    return new Response(
      JSON.stringify({ message: 'Email sent successfully', email_id: emailResponse.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Email function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Email content generators
function generateNewBacklinksEmail(backlinks: BacklinkData[]) {
  const count = backlinks.length
  const subject = `🔗 ${count} new backlink${count > 1 ? 's' : ''} discovered - ForgeRank`
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">New Backlinks Discovered!</h1>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
          Great news! ForgeRank found <strong>${count} new backlink${count > 1 ? 's' : ''}</strong> pointing to your tracked domains.
        </p>
        
        <div style="background: white; border-radius: 6px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #f97316;">
          <h3 style="margin: 0 0 12px 0; color: #333;">Recent Discoveries:</h3>
          ${backlinks.slice(0, 5).map(bl => `
            <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #eee;">
              <div style="font-weight: bold; color: #333;">${bl.source_domain}</div>
              <div style="color: #666; font-size: 14px; margin: 4px 0;">
                "${bl.anchor_text}" → ${new URL(bl.target_url).hostname}
              </div>
              <div style="color: #888; font-size: 12px;">
                ${bl.context_type} • ${new Date(bl.found_at).toLocaleDateString()}
              </div>
            </div>
          `).join('')}
          ${count > 5 ? `<div style="color: #666; font-style: italic;">And ${count - 5} more...</div>` : ''}
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="chrome-extension://[EXTENSION-ID]/index.html#backlinks" 
             style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View All Backlinks
          </a>
        </div>
        
        <div style="color: #666; font-size: 12px; text-align: center; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
          <p>You're receiving this because you have email notifications enabled in ForgeRank.</p>
          <p><a href="chrome-extension://[EXTENSION-ID]/index.html#settings">Manage notification preferences</a></p>
        </div>
      </div>
    </div>
  `
  
  const textContent = `
New Backlinks Discovered!

ForgeRank found ${count} new backlink${count > 1 ? 's' : ''} pointing to your tracked domains:

${backlinks.slice(0, 5).map(bl => 
  `• ${bl.source_domain} - "${bl.anchor_text}" (${bl.context_type})`
).join('\n')}

${count > 5 ? `And ${count - 5} more backlinks...\n` : ''}

View all backlinks in your ForgeRank extension.

--
ForgeRank - Real-time backlink monitoring
  `
  
  return { subject, htmlContent, textContent }
}

function generateWeeklyDigestEmail(data: WeeklyDigestData) {
  const subject = `📊 Weekly Backlink Report - ${data.new_backlinks} new discoveries`
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Weekly Backlink Report</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">
          ${new Date(data.period.start).toLocaleDateString()} - ${new Date(data.period.end).toLocaleDateString()}
        </p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div style="background: white; padding: 16px; border-radius: 6px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #10b981;">${data.new_backlinks}</div>
            <div style="color: #666;">New Backlinks</div>
          </div>
          <div style="background: white; padding: 16px; border-radius: 6px; text-align: center;">
            <div style="font-size: 32px; font-weight: bold; color: #3b82f6;">${data.total_backlinks}</div>
            <div style="color: #666;">Total Backlinks</div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div style="background: white; padding: 16px; border-radius: 6px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: ${data.broken_links > 0 ? '#ef4444' : '#10b981'};">${data.broken_links}</div>
            <div style="color: #666;">Broken Links</div>
          </div>
          <div style="background: white; padding: 16px; border-radius: 6px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${data.keywords_discovered}</div>
            <div style="color: #666;">Keywords Found</div>
          </div>
        </div>
        
        ${data.top_domains.length > 0 ? `
        <div style="background: white; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 12px 0; color: #333;">Top Linking Domains:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            ${data.top_domains.slice(0, 5).map(domain => `
              <li style="padding: 4px 0; color: #666;">• ${domain}</li>
            `).join('')}
          </ul>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="chrome-extension://[EXTENSION-ID]/index.html#dashboard" 
             style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Dashboard
          </a>
        </div>
        
        <div style="color: #666; font-size: 12px; text-align: center; margin-top: 20px; border-top: 1px solid #eee; padding-top: 20px;">
          <p>Weekly digest from ForgeRank - helping you track backlinks effortlessly.</p>
          <p><a href="chrome-extension://[EXTENSION-ID]/index.html#settings">Manage notification preferences</a></p>
        </div>
      </div>
    </div>
  `
  
  const textContent = `
Weekly Backlink Report
${new Date(data.period.start).toLocaleDateString()} - ${new Date(data.period.end).toLocaleDateString()}

📊 This Week's Stats:
• ${data.new_backlinks} new backlinks discovered
• ${data.total_backlinks} total backlinks tracked
• ${data.broken_links} broken links detected
• ${data.keywords_discovered} keywords found

${data.top_domains.length > 0 ? `
Top Linking Domains:
${data.top_domains.slice(0, 5).map(domain => `• ${domain}`).join('\n')}
` : ''}

Keep up the great work!

--
ForgeRank - Real-time backlink monitoring
  `
  
  return { subject, htmlContent, textContent }
}

function generateCompetitorAlertEmail(data: any) {
  const subject = `🎯 Competitor intelligence gathered - ${data.domain}`
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Competitor Analysis Complete</h1>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
          Smart scanning has finished analyzing <strong>${data.domain}</strong> and discovered valuable intelligence.
        </p>
        
        <div style="background: white; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 12px 0; color: #333;">Opportunities Found:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            ${data.opportunities.map((opp: string) => `<li style="margin: 4px 0; color: #666;">${opp}</li>`).join('')}
          </ul>
        </div>
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="chrome-extension://[EXTENSION-ID]/index.html#smart-scanning" 
             style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Full Analysis
          </a>
        </div>
      </div>
    </div>
  `
  
  const textContent = `
Competitor Analysis Complete

Smart scanning has finished analyzing ${data.domain}.

Opportunities Found:
${data.opportunities.map((opp: string) => `• ${opp}`).join('\n')}

View the full analysis in your ForgeRank extension.

--
ForgeRank - Competitor intelligence made simple
  `
  
  return { subject, htmlContent, textContent }
}

function generateHealthCheckSummaryEmail(data: any) {
  const subject = `🔍 Link Health Report - ${data.broken_count} issues found`
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${data.broken_count > 0 ? '#dc2626' : '#10b981'}; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Link Health Check Complete</h1>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="background: white; padding: 12px; border-radius: 6px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold; color: #10b981;">${data.healthy_count}</div>
            <div style="color: #666; font-size: 12px;">Healthy</div>
          </div>
          <div style="background: white; padding: 12px; border-radius: 6px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold; color: #f59e0b;">${data.redirected_count}</div>
            <div style="color: #666; font-size: 12px;">Redirected</div>
          </div>
          <div style="background: white; padding: 12px; border-radius: 6px; text-align: center;">
            <div style="font-size: 20px; font-weight: bold; color: #ef4444;">${data.broken_count}</div>
            <div style="color: #666; font-size: 12px;">Broken</div>
          </div>
        </div>
        
        ${data.broken_count > 0 ? `
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 8px 0; color: #dc2626;">Action Required:</h4>
          <p style="margin: 0; color: #7f1d1d;">${data.broken_count} backlinks need attention. Consider reaching out to site owners or updating your tracking list.</p>
        </div>
        ` : `
        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 6px; margin-bottom: 20px;">
          <p style="margin: 0; color: #166534;">✅ All your backlinks are healthy! Keep up the great work.</p>
        </div>
        `}
        
        <div style="text-align: center; margin: 20px 0;">
          <a href="chrome-extension://[EXTENSION-ID]/index.html#backlinks" 
             style="background: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
            View Detailed Report
          </a>
        </div>
      </div>
    </div>
  `
  
  const textContent = `
Link Health Check Complete

Results:
• ${data.healthy_count} healthy links
• ${data.redirected_count} redirected links  
• ${data.broken_count} broken links

${data.broken_count > 0 ? 
  'Some backlinks need attention. Check your ForgeRank extension for details.' :
  'All your backlinks are healthy!'
}

--
ForgeRank - Keep your backlinks healthy
  `
  
  return { subject, htmlContent, textContent }
}

// Simple email sending function (replace with your preferred service)
async function sendEmail({ to, subject, htmlContent, textContent }: {
  to: string
  subject: string
  htmlContent: string
  textContent: string
}) {
  try {
    // Using a simple HTTP email service (replace with Resend, SendGrid, etc.)
    // For demo purposes, we'll just log the email
    console.log('Sending email:', { to, subject })
    
    // Return mock success (replace with actual email service)
    return {
      success: true,
      id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    }
  }
}

/* To implement with Resend:

async function sendEmail({ to, subject, htmlContent, textContent }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'ForgeRank <notifications@forgerank.com>',
      to: [to],
      subject,
      html: htmlContent,
      text: textContent
    })
  })
  
  if (!response.ok) {
    throw new Error(`Email service error: ${response.statusText}`)
  }
  
  const result = await response.json()
  return { success: true, id: result.id }
}

*/
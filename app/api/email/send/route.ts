import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { createClient } from '@/utils/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const { to, cc, subject, body, leadId, leadName, templateUsed, sentByName } = await req.json()

    if (!to || !subject || !body) {
      return NextResponse.json({ error: 'Missing required fields: to, subject, body' }, { status: 400 })
    }

    const supabase = await createClient()

    // 1. Fetch SMTP Config
    const { data: config } = await supabase
      .from('email_smtp_config')
      .select('*')
      .limit(1)
      .maybeSingle()

    const provider = config?.provider || 'smtp'
    const fromName = config?.from_name || process.env.RESEND_FROM_NAME || 'AYKA Alliance'
    const fromEmail = config?.from_email || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const isSmtp = provider === 'smtp'

    let sendErrorMsg = null

    // Helper to format HTML and handle markdown links
    const markdownToHtml = (text: string) => {
      // Convert markdown links [Text](URL) to HTML links
      let html = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        return `<a href="${url}" style="color: #2563eb; text-decoration: underline;">${label}</a>`
      })
      
      // Split by double newlines for paragraphs
      const paragraphs = html.split(/\n\n+/)
      return paragraphs
        .map(p => {
          const content = p.trim().replace(/\n/g, '<br/>')
          return `<p style="margin: 0 0 16px 0; line-height: 1.6;">${content}</p>`
        })
        .join('')
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #111827;">
        ${markdownToHtml(body)}
      </div>
    `

    if (isSmtp) {
      if (!config?.smtp_host || !config?.smtp_user || !config?.smtp_pass) {
        return NextResponse.json({ error: 'SMTP configuration is incomplete in settings.' }, { status: 400 })
      }
      
      const transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: config.smtp_port || 587,
        secure: config.smtp_secure || false,
        auth: {
          user: config.smtp_user,
          pass: config.smtp_pass,
        },
      })

      try {
        await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to,
          cc: cc || undefined,
          bcc: 'alliance@aykacare.in',
          subject,
          text: body,
          html: htmlBody,
        })
      } catch (err: any) {
        sendErrorMsg = err.message || 'SMTP Send Failed'
      }
    } else {
      // Use Resend
      const apiKey = config?.resend_api_key || process.env.RESEND_API_KEY
      if (!apiKey) {
         return NextResponse.json({ error: 'Resend API key is missing.' }, { status: 400 })
      }
      const resend = new Resend(apiKey)

      const { error: resendErr } = await resend.emails.send({
        from: `${fromName} <${fromEmail}>`,
        to: [to],
        cc: cc ? [cc] : undefined,
        bcc: ['alliance@aykacare.in'],
        subject,
        html: htmlBody,
      })

      if (resendErr) {
        sendErrorMsg = resendErr.message
      }
    }

    if (sendErrorMsg) {
      console.error('Email send error:', sendErrorMsg)
      await supabase.from('email_logs').insert({
        sent_by_name: sentByName || 'Unknown',
        lead_id: leadId || null,
        lead_name: leadName || null,
        to_email: to,
        subject,
        body,
        template_used: templateUsed || null,
        status: 'failed',
      })
      return NextResponse.json({ error: sendErrorMsg }, { status: 500 })
    }

    // Success - Log to email_logs table
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('email_logs').insert({
      sent_by_id: user?.id || null,
      sent_by_name: sentByName || user?.email || 'Unknown',
      lead_id: leadId || null,
      lead_name: leadName || null,
      to_email: to,
      subject,
      body,
      template_used: templateUsed || null,
      status: 'sent',
    })

    // If linked to a lead, also log as a lead activity
    if (leadId) {
      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: 'remark',
        remark: `📧 Email sent to ${to}\n\nSubject: ${subject}\n\n${body}`,
        created_by: sentByName || user?.email || 'Unknown',
      })

      // Update last_activity timestamp on the lead
      await supabase
        .from('leads')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', leadId)
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error('Email send error:', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Send, Clock, User, ChevronDown, Search, X, CheckCircle, AlertCircle, FileText, Settings, ArrowLeft } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Lead, Profile } from '@/types/lead'
import MailConfig from './MailConfig'

interface EmailLog {
  id: string
  created_at: string
  sent_by_name: string
  lead_id: string | null
  lead_name: string | null
  to_email: string
  subject: string
  body: string
  template_used: string | null
  status: 'sent' | 'failed'
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

interface MailSectionProps {
  currentProfile: Profile | null
  initialLead?: Lead | null
}

export default function MailSection({ currentProfile, initialLead }: MailSectionProps) {
  const [viewMode, setViewMode] = useState<'compose' | 'settings'>('compose')
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [dbTemplates, setDbTemplates] = useState<EmailTemplate[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadData, setSelectedLeadData] = useState<Lead | null>(initialLead || null)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null)
  const [logSearch, setLogSearch] = useState('')

  // Compose form state
  const [toEmail, setToEmail] = useState(initialLead?.email || '')
  const [toName, setToName] = useState(initialLead?.name || '')
  const [linkedLeadId, setLinkedLeadId] = useState(initialLead?.id || '')
  const [linkedLeadName, setLinkedLeadName] = useState(initialLead?.name || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [ccEmail, setCcEmail] = useState(currentProfile?.email || '')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [leadSearch, setLeadSearch] = useState(initialLead?.name || '')
  const [showLeadDropdown, setShowLeadDropdown] = useState(false)

  useEffect(() => {
    if (currentProfile?.email && !ccEmail) {
      setCcEmail(currentProfile.email)
    }
  }, [currentProfile, ccEmail])

  const supabase = createClient()

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const { data } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      setEmailLogs((data as EmailLog[]) || [])
    } finally {
      setLoadingLogs(false)
    }
  }, [supabase])

  const fetchLeads = useCallback(async () => {
    const { data } = await supabase
      .from('leads')
      .select('id, name, email, contact')
      .not('email', 'is', null)
      .order('name', { ascending: true })
      .limit(200)
    setLeads((data as Lead[]) || [])
  }, [supabase])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/email/templates')
      const data = await res.json()
      if (data.templates) setDbTemplates(data.templates)
    } catch (e) {
      console.error('Failed to fetch templates', e)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
    fetchLeads()
    fetchTemplates()
  }, [fetchLogs, fetchLeads, fetchTemplates])

  // Process template string with lead/user variables
  const fillTemplate = (text: string, lead: Lead | null, user: Profile | null) => {
    if (!text) return ''
    return text
      .replace(/{name}/g, lead?.name || toName || 'Sir/Madam')
      .replace(/{email}/g, lead?.email || toEmail || '')
      .replace(/{phone}/g, lead?.contact || '')
      .replace(/{city}/g, lead?.city || 'your city')
      .replace(/{state}/g, lead?.state || 'your state')
      .replace(/{fm_type}/g, lead?.fm_type || 'Franchise')
      .replace(/{assigned_to}/g, user?.display_name || 'Our Team')
  }

  const applyTemplate = (templateId: string, leadOverride: Lead | null = selectedLeadData) => {
    if (templateId === 'custom') {
      setSelectedTemplate('custom')
      setSubject('')
      setBody('')
      return
    }

    const tmpl = dbTemplates.find(t => t.id === templateId)
    if (!tmpl) return
    setSelectedTemplate(templateId)
    setSubject(fillTemplate(tmpl.subject, leadOverride, currentProfile))
    setBody(fillTemplate(tmpl.body, leadOverride, currentProfile))
  }

  const handleLeadSelect = (lead: Lead) => {
    setToEmail(lead.email || '')
    setToName(lead.name)
    setLinkedLeadId(lead.id)
    setLinkedLeadName(lead.name)
    setLeadSearch(lead.name)
    setSelectedLeadData(lead)
    setShowLeadDropdown(false)
    
    // Re-apply current template with new lead data
    if (selectedTemplate && selectedTemplate !== 'custom') {
      applyTemplate(selectedTemplate, lead)
    }
  }

  const handleSend = async () => {
    if (!toEmail || !subject || !body) {
      setSendResult({ type: 'error', message: 'Please fill in To email, Subject and Body.' })
      return
    }

    setSending(true)
    setSendResult(null)

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail,
          cc: ccEmail,
          subject,
          body,
          leadId: linkedLeadId || null,
          leadName: linkedLeadName || null,
          templateUsed: selectedTemplate || null,
          sentByName: currentProfile?.display_name || 'Unknown',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSendResult({ type: 'error', message: data.error || 'Failed to send email.' })
      } else {
        setSendResult({ type: 'success', message: `Email sent to ${toEmail} successfully!` })
        // Reset form
        setSubject('')
        setBody('')
        setSelectedTemplate('')
        // Refresh logs
        fetchLogs()
      }
    } catch {
      setSendResult({ type: 'error', message: 'Network error. Please try again.' })
    } finally {
      setSending(false)
    }
  }

  const filteredLogs = emailLogs.filter(log =>
    !logSearch ||
    log.to_email.toLowerCase().includes(logSearch.toLowerCase()) ||
    log.subject.toLowerCase().includes(logSearch.toLowerCase()) ||
    (log.lead_name || '').toLowerCase().includes(logSearch.toLowerCase())
  )

  const filteredLeads = leads.filter(l =>
    leadSearch.length > 0 &&
    (l.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      (l.email || '').toLowerCase().includes(leadSearch.toLowerCase()))
  ).slice(0, 8)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>Mail</h1>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--text-muted)' }}>
            Compose and send emails to leads. All sent emails are logged in lead activity.
          </p>
        </div>
        <button
          onClick={() => setViewMode(viewMode === 'compose' ? 'settings' : 'compose')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '6px', cursor: 'pointer',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontWeight: '600', fontSize: '13px'
          }}
        >
          {viewMode === 'compose' ? <><Settings size={14} /> Settings & Templates</> : <><ArrowLeft size={14} /> Back to Compose</>}
        </button>
      </div>

      {viewMode === 'settings' ? (
        <MailConfig />
      ) : (
        <div className="grid-mail">

        {/* ── LEFT: Sent History ── */}
        <div className="crm-card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Clock size={15} color="var(--accent)" />
              <span style={{ fontSize: '13px', fontWeight: '700' }}>Sent Emails</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '2px 8px', borderRadius: '20px' }}>
              {emailLogs.length}
            </span>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '12px' }}>
            <Search size={13} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="crm-input"
              style={{ paddingLeft: '28px', fontSize: '12px', padding: '7px 10px 7px 28px' }}
              placeholder="Search by name, email, subject..."
              value={logSearch}
              onChange={e => setLogSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '520px', overflowY: 'auto' }}>
            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
            ) : filteredLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No emails sent yet.
              </div>
            ) : filteredLogs.map(log => (
              <div
                key={log.id}
                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: `1px solid ${selectedLog?.id === log.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedLog?.id === log.id ? 'var(--accent-muted)' : 'var(--surface-2)',
                  cursor: 'pointer',
                  transition: 'all 0.1s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    {log.subject}
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: '600', padding: '1px 6px', borderRadius: '10px',
                    background: log.status === 'sent' ? 'rgba(46,213,115,0.15)' : 'rgba(255,71,87,0.15)',
                    color: log.status === 'sent' ? 'var(--success)' : 'var(--danger)',
                  }}>
                    {log.status === 'sent' ? '✓ Sent' : '✗ Failed'}
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  To: {log.to_email}
                </div>
                {log.lead_name && (
                  <div style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '2px' }}>
                    Lead: {log.lead_name}
                  </div>
                )}
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{new Date(log.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span>{log.sent_by_name}</span>
                </div>

                {/* Expanded body */}
                {selectedLog?.id === log.id && (
                  <div style={{
                    marginTop: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}>
                    {log.body}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Compose ── */}
        <div className="crm-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <Mail size={16} color="var(--accent)" />
            <span style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>Compose Email</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Template Picker */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Template
                </label>
                <button
                  onClick={() => setViewMode('settings')}
                  style={{ fontSize: '11px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600', padding: 0 }}
                >
                  <Settings size={11} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'text-top' }} />
                  Manage Templates
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <select
                  className="crm-input"
                  value={selectedTemplate}
                  onChange={e => applyTemplate(e.target.value)}
                  style={{ paddingRight: '32px', appearance: 'none' }}
                >
                  <option value="">— Select a template or write custom —</option>
                  {dbTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                  <option value="custom">✏️ Custom Email</option>
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Lead Picker */}
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <User size={11} style={{ display: 'inline', marginRight: '4px' }} />
                Link to Lead (optional)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="crm-input"
                  placeholder="Search lead name to auto-fill email..."
                  value={leadSearch}
                  onChange={e => { setLeadSearch(e.target.value); setShowLeadDropdown(true) }}
                  onFocus={() => setShowLeadDropdown(true)}
                  onBlur={() => setTimeout(() => setShowLeadDropdown(false), 200)}
                />
                {linkedLeadId && (
                  <button
                    onClick={() => { setLinkedLeadId(''); setLinkedLeadName(''); setLeadSearch('') }}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {showLeadDropdown && filteredLeads.length > 0 && (
                <div style={{
                  position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  marginTop: '4px', overflow: 'hidden'
                }}>
                  {filteredLeads.map(lead => (
                    <div
                      key={lead.id}
                      onMouseDown={() => handleLeadSelect(lead)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: '13px' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-muted)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{lead.name}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{lead.email}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* To */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                To (Email Address)
              </label>
              <input
                className="crm-input"
                type="email"
                placeholder="customer@example.com"
                value={toEmail}
                onChange={e => setToEmail(e.target.value)}
              />
            </div>

            {/* CC */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cc (Email Address)
              </label>
              <input
                className="crm-input"
                type="email"
                placeholder="cc@example.com"
                value={ccEmail}
                onChange={e => setCcEmail(e.target.value)}
              />
            </div>

            {/* Subject */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Subject
              </label>
              <input
                className="crm-input"
                placeholder="Email subject..."
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>

            {/* Body */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <FileText size={11} style={{ display: 'inline', marginRight: '4px' }} />
                Message
              </label>
              <textarea
                className="crm-input"
                placeholder="Write your email message here..."
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={12}
                style={{ resize: 'vertical', lineHeight: '1.6', fontFamily: 'inherit' }}
              />
            </div>

            {/* Result Banner */}
            {sendResult && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '8px',
                background: sendResult.type === 'success' ? 'rgba(46,213,115,0.1)' : 'rgba(255,71,87,0.1)',
                border: `1px solid ${sendResult.type === 'success' ? 'rgba(46,213,115,0.3)' : 'rgba(255,71,87,0.3)'}`,
                color: sendResult.type === 'success' ? 'var(--success)' : 'var(--danger)',
                fontSize: '13px',
              }}>
                {sendResult.type === 'success'
                  ? <CheckCircle size={15} />
                  : <AlertCircle size={15} />}
                {sendResult.message}
              </div>
            )}

            {/* Send Button */}
            <button
              className="btn-primary"
              onClick={handleSend}
              disabled={sending || !toEmail || !subject || !body}
              style={{ justifyContent: 'center', padding: '12px', fontSize: '14px', gap: '8px', opacity: (!toEmail || !subject || !body) ? 0.5 : 1 }}
            >
              <Send size={15} />
              {sending ? 'Sending...' : 'Send Email'}
            </button>

          </div>
        </div>
      </div>
      )}
    </div>
  )
}

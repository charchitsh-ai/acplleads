'use client'

import { useState, useEffect } from 'react'
import { Save, Plus, Trash2, Edit2, CheckCircle, AlertCircle, Server, Mail } from 'lucide-react'

export default function MailConfig() {
  const [activeTab, setActiveTab] = useState<'smtp' | 'templates'>('smtp')
  const [config, setConfig] = useState<any>({ provider: 'smtp', smtp_port: 587, smtp_secure: false })
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ type: 'success' | 'error', message: string } | null>(null)

  // Template form state
  const [editingTemplate, setEditingTemplate] = useState<any>(null)
  const [tmplName, setTmplName] = useState('')
  const [tmplSubject, setTmplSubject] = useState('')
  const [tmplBody, setTmplBody] = useState('')
  const [tmplDesc, setTmplDesc] = useState('')

  useEffect(() => {
    fetchConfig()
    fetchTemplates()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/email/config')
      const data = await res.json()
      if (data.config) {
        setConfig(data.config)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/email/templates')
      const data = await res.json()
      if (data.templates) {
        setTemplates(data.templates)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const saveConfig = async () => {
    setSaving(true)
    setSaveResult(null)
    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Failed to save config')
      setSaveResult({ type: 'success', message: 'Configuration saved successfully!' })
      setTimeout(() => setSaveResult(null), 3000)
    } catch (e: any) {
      setSaveResult({ type: 'error', message: e.message })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTemplate = async () => {
    setSaving(true)
    setSaveResult(null)
    try {
      const payload = { name: tmplName, subject: tmplSubject, body: tmplBody, description: tmplDesc }
      const isEdit = !!editingTemplate?.id
      const method = isEdit ? 'PUT' : 'POST'
      const body = isEdit ? { id: editingTemplate.id, ...payload } : payload

      const res = await fetch('/api/email/templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to save template')
      
      setSaveResult({ type: 'success', message: 'Template saved successfully!' })
      setEditingTemplate(null)
      setTmplName('')
      setTmplSubject('')
      setTmplBody('')
      setTmplDesc('')
      fetchTemplates()
      setTimeout(() => setSaveResult(null), 3000)
    } catch (e: any) {
      setSaveResult({ type: 'error', message: e.message })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      await fetch('/api/email/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      fetchTemplates()
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading settings...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
        <button
          onClick={() => setActiveTab('smtp')}
          style={{
            padding: '8px 16px', background: activeTab === 'smtp' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'smtp' ? 'white' : 'var(--text-secondary)',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Server size={14} /> SMTP Config
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          style={{
            padding: '8px 16px', background: activeTab === 'templates' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'templates' ? 'white' : 'var(--text-secondary)',
            border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <Mail size={14} /> Templates Manager
        </button>
      </div>

      {saveResult && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px',
          background: saveResult.type === 'success' ? 'rgba(46,213,115,0.1)' : 'rgba(255,71,87,0.1)',
          color: saveResult.type === 'success' ? 'var(--success)' : 'var(--danger)',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px'
        }}>
          {saveResult.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {saveResult.message}
        </div>
      )}

      {/* SMTP Config */}
      {activeTab === 'smtp' && (
        <div className="crm-card" style={{ padding: '20px', maxWidth: '600px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Email Provider Settings</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="crm-label">Provider</label>
              <select 
                className="crm-input" 
                value={config.provider || 'smtp'}
                onChange={e => setConfig({...config, provider: e.target.value})}
              >
                <option value="smtp">Custom SMTP Server</option>
                <option value="resend">Resend API</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label className="crm-label">From Name</label>
                <input className="crm-input" value={config.from_name || ''} onChange={e => setConfig({...config, from_name: e.target.value})} placeholder="AYKA Alliance" />
              </div>
              <div>
                <label className="crm-label">From Email</label>
                <input className="crm-input" value={config.from_email || ''} onChange={e => setConfig({...config, from_email: e.target.value})} placeholder="info@ayka.in" />
              </div>
            </div>

            {config.provider === 'smtp' && (
              <>
                <div>
                  <label className="crm-label">SMTP Host</label>
                  <input className="crm-input" value={config.smtp_host || ''} onChange={e => setConfig({...config, smtp_host: e.target.value})} placeholder="smtp.gmail.com" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="crm-label">SMTP Port</label>
                    <input className="crm-input" type="number" value={config.smtp_port || 587} onChange={e => setConfig({...config, smtp_port: parseInt(e.target.value)})} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '24px' }}>
                    <input type="checkbox" checked={config.smtp_secure || false} onChange={e => setConfig({...config, smtp_secure: e.target.checked})} id="secure" />
                    <label htmlFor="secure" style={{ fontSize: '13px' }}>Use TLS/SSL</label>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label className="crm-label">SMTP Username</label>
                    <input className="crm-input" value={config.smtp_user || ''} onChange={e => setConfig({...config, smtp_user: e.target.value})} />
                  </div>
                  <div>
                    <label className="crm-label">SMTP Password</label>
                    <input className="crm-input" type="password" value={config.smtp_pass || ''} onChange={e => setConfig({...config, smtp_pass: e.target.value})} />
                  </div>
                </div>
              </>
            )}

            {config.provider === 'resend' && (
              <div>
                <label className="crm-label">Resend API Key</label>
                <input className="crm-input" type="password" value={config.resend_api_key || ''} onChange={e => setConfig({...config, resend_api_key: e.target.value})} placeholder="re_..." />
              </div>
            )}

            <button className="btn-primary" onClick={saveConfig} disabled={saving} style={{ alignSelf: 'flex-start', marginTop: '10px' }}>
              <Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* Templates Manager */}
      {activeTab === 'templates' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* List */}
          <div className="crm-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Email Templates</h3>
              <button className="btn-primary" onClick={() => {
                setEditingTemplate(null)
                setTmplName('')
                setTmplSubject('')
                setTmplBody('')
                setTmplDesc('')
              }}>
                <Plus size={14} style={{ marginRight: '4px' }} /> New
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {templates.map(t => (
                <div key={t.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{t.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.subject}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => {
                      setEditingTemplate(t)
                      setTmplName(t.name)
                      setTmplSubject(t.subject)
                      setTmplBody(t.body)
                      setTmplDesc(t.description || '')
                    }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}>
                      <Edit2 size={15} />
                    </button>
                    {!t.is_default && (
                      <button onClick={() => handleDeleteTemplate(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Form */}
          <div className="crm-card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>{editingTemplate ? 'Edit Template' : 'Create Template'}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="crm-label">Template Name</label>
                <input className="crm-input" value={tmplName} onChange={e => setTmplName(e.target.value)} placeholder="e.g. Initial Outreach" />
              </div>
              <div>
                <label className="crm-label">Description (optional)</label>
                <input className="crm-input" value={tmplDesc} onChange={e => setTmplDesc(e.target.value)} placeholder="When to use this template..." />
              </div>
              <div>
                <label className="crm-label">Email Subject</label>
                <input className="crm-input" value={tmplSubject} onChange={e => setTmplSubject(e.target.value)} />
              </div>
              <div>
                <label className="crm-label">Email Body</label>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Available variables: {'{name}, {email}, {phone}, {city}, {state}, {fm_type}, {assigned_to}'}
                </div>
                <textarea 
                  className="crm-input" 
                  value={tmplBody} 
                  onChange={e => setTmplBody(e.target.value)} 
                  rows={10} 
                  style={{ fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              <button className="btn-primary" onClick={handleSaveTemplate} disabled={saving || !tmplName || !tmplSubject || !tmplBody} style={{ alignSelf: 'flex-start' }}>
                <Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

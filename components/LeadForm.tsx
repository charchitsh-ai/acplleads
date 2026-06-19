'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Lead, LeadInsert, FmType, LeadQuality, FollowUpStatus, ObjectionTag, Profile } from '@/types/lead'
import { createClient } from '@/utils/supabase/client'
import { logUserActivity } from '@/utils/activity-log'

interface LeadFormProps {
  lead?: Lead | null
  profiles?: Profile[]
  onClose: () => void
  onSaved: () => void
}

const FM_TYPES: FmType[] = ['CF', 'MF', 'DF', 'SF', 'Collab']
const LEAD_QUALITIES: LeadQuality[] = ['#Hot_Lead', '#Warm_Lead', '#Cold_Lead', '#Low_Potential']
const FOLLOW_UP_STATUSES: FollowUpStatus[] = ['#First_Call', '#Followup_1', '#Followup_2', '#Meeting_Scheduled', '#Proposal_Sent', '#Contacted', '#Lost']
const OBJECTION_TAGS: ObjectionTag[] = ['#Need_More_Time', '#ROI_Concern', '#Investment_Issue', '#Not_Interested', '#Discuss_With_Partner', '#Documents_Pending']
const SOURCES = ['Facebook_Ads', 'Instagram_Ads', 'WhatsApp', 'Website', 'Referral', 'Other']

const EMPTY: LeadInsert = {
  name: '',
  contact: '',
  email: '',
  city: '',
  state: '',
  occupation: '',
  assigned_to: 'Charchit',
  assigned_user_id: undefined,
  fbdm: '',
  fm_type: undefined,
  source: 'Facebook_Ads',
  lead_quality: undefined,
  follow_up_status: undefined,
  objection_tag: undefined,
  last_remark: '',
  lead_date: new Date().toISOString().split('T')[0],
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px', fontWeight: '500' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const TRACKED_TAG_FIELDS: Array<{ key: keyof LeadInsert; label: string }> = [
  { key: 'assigned_to', label: 'Assigned To' },
  { key: 'fm_type', label: 'FM Type' },
  { key: 'source', label: 'Source' },
  { key: 'lead_quality', label: 'Lead Quality' },
  { key: 'follow_up_status', label: 'Follow-up Status' },
  { key: 'objection_tag', label: 'Objection Tag' },
]

function cleanValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function formatTagValue(value: unknown) {
  return cleanValue(value) || 'Empty'
}

function getTagActivities(form: LeadInsert, lead?: Lead | null) {
  return TRACKED_TAG_FIELDS.flatMap(({ key, label }) => {
    const nextValue = cleanValue(form[key])
    const previousValue = cleanValue(lead?.[key as keyof Lead])

    if (lead?.id) {
      if (previousValue === nextValue) return []
      return [`${label} changed: ${formatTagValue(previousValue)} -> ${formatTagValue(nextValue)}`]
    }

    if (!nextValue) return []
    return [`${label} selected: ${formatTagValue(nextValue)}`]
  })
}

export default function LeadForm({ lead, profiles = [], onClose, onSaved }: LeadFormProps) {
  const [form, setForm] = useState<LeadInsert>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (lead) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: lead.name || '',
        contact: lead.contact || '',
        email: lead.email || '',
        city: lead.city || '',
        state: lead.state || '',
        occupation: lead.occupation || '',
        assigned_to: lead.assigned_to || 'Charchit',
        assigned_user_id: lead.assigned_user_id,
        fbdm: lead.fbdm || '',
        fm_type: lead.fm_type,
        source: lead.source || 'Facebook_Ads',
        lead_quality: lead.lead_quality,
        follow_up_status: lead.follow_up_status,
        objection_tag: lead.objection_tag,
        last_remark: lead.last_remark || '',
        lead_date: lead.lead_date || new Date().toISOString().split('T')[0],
      })
    }
  }, [lead])

  const set = (key: keyof LeadInsert, value: string) => {
    setForm(prev => ({ ...prev, [key]: value || undefined }))
  }

  const setAssignedUser = (userId: string) => {
    const profile = profiles.find(item => item.id === userId)
    setForm(prev => ({
      ...prev,
      assigned_user_id: userId || undefined,
      assigned_to: profile?.display_name || prev.assigned_to,
    }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const remark = form.last_remark?.trim()
      const tagActivities = getTagActivities(form, lead)
      const hasActivity = Boolean(remark && remark !== (lead?.last_remark || '').trim()) || tagActivities.length > 0
      const payload = hasActivity
        ? { ...form, last_remark: remark, last_activity: now }
        : form

      if (lead?.id) {
        const { error } = await supabase.from('leads').update(payload).eq('id', lead.id)
        if (error) throw error
        const activities = [
          ...tagActivities.map(text => ({
            lead_id: lead.id,
            activity_type: 'updated',
            remark: text,
            created_by: form.assigned_to || null,
          })),
          ...(remark && remark !== (lead.last_remark || '').trim()
            ? [{
              lead_id: lead.id,
              activity_type: 'remark',
              remark,
              created_by: form.assigned_to || null,
            }]
            : []),
        ]
        if (activities.length > 0) {
          const { error: activityError } = await supabase.from('lead_activities').insert(activities)
          if (activityError) throw activityError
        }
        if (form.assigned_user_id !== lead.assigned_user_id || form.assigned_to !== lead.assigned_to) {
          await logUserActivity(supabase, {
            activity_type: 'lead_assigned',
            lead_id: lead.id,
            lead_name: form.name,
            target_user_id: form.assigned_user_id || null,
            target_user_name: form.assigned_to || null,
            detail: `Assigned ${form.name} to ${form.assigned_to || 'Unassigned'}`,
          })
        }
        await logUserActivity(supabase, {
          activity_type: remark && remark !== (lead.last_remark || '').trim() ? 'lead_remark' : 'lead_updated',
          lead_id: lead.id,
          lead_name: form.name,
          target_user_id: form.assigned_user_id || null,
          target_user_name: form.assigned_to || null,
          detail: activities.length > 0 ? activities.map(item => item.remark).join('; ') : `Updated lead: ${form.name}`,
        })
      } else {
        const { data, error } = await supabase.from('leads').insert(payload).select('id').single()
        if (error) throw error
        const activities = data?.id ? [
          ...tagActivities.map(text => ({
            lead_id: data.id,
            activity_type: 'created',
            remark: text,
            created_by: form.assigned_to || null,
          })),
          ...(remark
            ? [{
              lead_id: data.id,
              activity_type: 'remark',
              remark,
              created_by: form.assigned_to || null,
            }]
            : []),
        ] : []
        if (activities.length > 0) {
          const { error: activityError } = await supabase.from('lead_activities').insert(activities)
          if (activityError) throw activityError
        }
        if (data?.id) {
          await logUserActivity(supabase, {
            activity_type: 'lead_created',
            lead_id: data.id,
            lead_name: form.name,
            target_user_id: form.assigned_user_id || null,
            target_user_name: form.assigned_to || null,
            detail: `Created lead: ${form.name}${form.assigned_to ? ` assigned to ${form.assigned_to}` : ''}`,
          })
        }
      }
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '580px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)'
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
            {lead ? 'Edit Lead' : 'Add New Lead'}
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: '4px'
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ overflow: 'auto', padding: '20px', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Name *">
                <input className="crm-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
              </Field>
            </div>

            <Field label="Contact">
              <input className="crm-input" value={form.contact || ''} onChange={e => set('contact', e.target.value)} placeholder="91XXXXXXXXXX" />
            </Field>

            <Field label="Email">
              <input className="crm-input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
            </Field>

            <Field label="City">
              <input className="crm-input" value={form.city || ''} onChange={e => set('city', e.target.value)} placeholder="City" />
            </Field>

            <Field label="State">
              <input className="crm-input" value={form.state || ''} onChange={e => set('state', e.target.value)} placeholder="State" />
            </Field>

            <Field label="Occupation">
              <input className="crm-input" value={form.occupation || ''} onChange={e => set('occupation', e.target.value)} placeholder="Doctor, Businessman..." />
            </Field>

            <Field label="Lead Date">
              <input className="crm-input" type="date" value={form.lead_date || ''} onChange={e => set('lead_date', e.target.value)} />
            </Field>

            <Field label="FM Type">
              <select className="crm-input" value={form.fm_type || ''} onChange={e => set('fm_type', e.target.value)}>
                <option value="">Select...</option>
                {FM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Source">
              <select className="crm-input" value={form.source || ''} onChange={e => set('source', e.target.value)}>
                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Lead Quality">
              <select className="crm-input" value={form.lead_quality || ''} onChange={e => set('lead_quality', e.target.value)}>
                <option value="">Select...</option>
                {LEAD_QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>

            <Field label="Follow-up Status">
              <select className="crm-input" value={form.follow_up_status || ''} onChange={e => set('follow_up_status', e.target.value)}>
                <option value="">Select...</option>
                {FOLLOW_UP_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Objection Tag">
              <select className="crm-input" value={form.objection_tag || ''} onChange={e => set('objection_tag', e.target.value)}>
                <option value="">Select...</option>
                {OBJECTION_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <Field label="Assigned To">
              {profiles.length > 0 ? (
                <select className="crm-input" value={form.assigned_user_id || ''} onChange={e => setAssignedUser(e.target.value)}>
                  <option value="">Manual / Unassigned</option>
                  {profiles.map(profile => (
                    <option key={profile.id} value={profile.id}>{profile.display_name} - {profile.role}</option>
                  ))}
                </select>
              ) : (
                <input className="crm-input" value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} placeholder="Charchit" />
              )}
            </Field>

            <Field label="FBDM">
              <input className="crm-input" value={form.fbdm || ''} onChange={e => set('fbdm', e.target.value)} placeholder="Kartikey" />
            </Field>

            <div style={{ gridColumn: '1 / -1' }}>
              <Field label="Last Remark">
                <textarea
                  className="crm-input"
                  value={form.last_remark || ''}
                  onChange={e => set('last_remark', e.target.value)}
                  placeholder="Add notes about this lead..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </Field>
            </div>
          </div>

          {error && (
            <div style={{
              marginTop: '14px', padding: '10px 12px',
              background: 'rgba(255,71,87,0.1)',
              border: '1px solid rgba(255,71,87,0.3)',
              borderRadius: '8px', fontSize: '13px', color: 'var(--danger)'
            }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '14px 20px',
          borderTop: '1px solid var(--border)'
        }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : lead ? 'Update Lead' : 'Add Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}

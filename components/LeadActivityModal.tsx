'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, MessageSquare, X } from 'lucide-react'
import { Lead, LeadActivity } from '@/types/lead'
import { createClient } from '@/utils/supabase/client'
import { logUserActivity } from '@/utils/activity-log'

interface LeadActivityModalProps {
  lead: Lead
  onClose: () => void
  onChanged: () => void
}

function formatActivityTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function LeadActivityModal({ lead, onClose, onChanged }: LeadActivityModalProps) {
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [remark, setRemark] = useState('')
  const [nextFollowup, setNextFollowup] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const fetchActivities = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setActivities(data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [lead.id, supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchActivities()
  }, [fetchActivities])

  const handleAddRemark = async () => {
    const text = remark.trim()
    if (!text) return

    setSaving(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const followupValue = nextFollowup ? new Date(nextFollowup).toISOString() : null

      const { error: activityError } = await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        activity_type: 'remark',
        remark: text,
        created_by: lead.assigned_to || null,
        next_followup_date: followupValue
      })
      if (activityError) throw activityError

      const { error: leadError } = await supabase
        .from('leads')
        .update({ 
          last_remark: text, 
          last_activity: now,
          next_followup_date: followupValue
        })
        .eq('id', lead.id)
      if (leadError) throw leadError

      await logUserActivity(supabase, {
        activity_type: 'lead_remark',
        lead_id: lead.id,
        lead_name: lead.name,
        target_user_id: lead.assigned_user_id || null,
        target_user_name: lead.assigned_to || null,
        detail: `Added remark on ${lead.name}: ${text}${followupValue ? ` (Next follow-up: ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(followupValue))})` : ''}`,
      })

      setRemark('')
      setNextFollowup('')
      await fetchActivities()
      onChanged()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add remark')
    } finally {
      setSaving(false)
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
        borderRadius: '12px',
        width: '100%',
        maxWidth: '620px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Activity History</h2>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              {lead.name}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: '4px'
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Add Remark *
              </label>
              <textarea
                className="crm-input"
                value={remark}
                onChange={e => setRemark(e.target.value)}
                placeholder="Write follow-up note, call update, meeting status..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Schedule Next Follow-up (Optional)
              </label>
              <input
                type="datetime-local"
                className="crm-input"
                value={nextFollowup}
                onChange={e => setNextFollowup(e.target.value)}
                style={{ width: '100%', maxWidth: '240px' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
            <button className="btn-primary" onClick={handleAddRemark} disabled={saving || !remark.trim()}>
              <MessageSquare size={14} /> {saving ? 'Saving...' : 'Save Remark'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            margin: '14px 20px 0',
            padding: '10px 12px',
            background: 'rgba(255,71,87,0.1)',
            border: '1px solid rgba(255,71,87,0.3)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--danger)'
          }}>
            {error}
          </div>
        )}

        <div style={{ overflow: 'auto', padding: '18px 20px', flex: 1 }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '28px' }}>
              Loading activity...
            </div>
          ) : activities.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '28px' }}>
              No activity yet. Add the first remark above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activities.map(activity => (
                <div key={activity.id} style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '12px',
                  background: 'var(--surface-2)'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    marginBottom: '8px'
                  }}>
                    <span className="badge badge-followup">{activity.activity_type}</span>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: 'var(--text-muted)',
                      fontSize: '12px',
                      whiteSpace: 'nowrap'
                    }}>
                      <Clock size={12} /> {formatActivityTime(activity.created_at)}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {activity.remark}
                  </div>
                  
                  {activity.next_followup_date && (
                    <div style={{
                      marginTop: '8px',
                      padding: '6px 10px',
                      background: 'rgba(163,192,38,0.08)',
                      border: '1px dashed rgba(163,192,38,0.3)',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12.5px',
                      color: 'var(--accent)'
                    }}>
                      <span>📅</span>
                      <span>Next Follow-up scheduled for:</span>
                      <strong>{formatActivityTime(activity.next_followup_date)}</strong>
                    </div>
                  )}

                  {activity.created_by && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: activity.next_followup_date ? '8px' : '6px' }}>
                      By {activity.created_by}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { PlusCircle, RefreshCw, Eye } from 'lucide-react'
import { Lead, Profile } from '@/types/lead'
import { createClient } from '@/utils/supabase/client'
import { QualityBadge, FollowUpBadge } from '@/components/Badges'

interface NewLeadsPanelProps {
  currentProfile: Profile | null
  onViewLead: (lead: Lead) => void
}

function formatLeadTime(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function NewLeadsPanel({ currentProfile, onViewLead }: NewLeadsPanelProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const fetchNewLeads = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (currentProfile && currentProfile.role !== 'admin') {
        query = query.eq('assigned_user_id', currentProfile.id)
      }

      const { data, error } = await query
      if (error) throw error
      setLeads(data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load new leads')
    } finally {
      setLoading(false)
    }
  }, [supabase, currentProfile])

  useEffect(() => {
    fetchNewLeads()
  }, [fetchNewLeads])

  return (
    <div className="crm-card" style={{ padding: '16px', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlusCircle size={16} color="var(--accent)" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Recently Added Leads</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Most recently created leads in the system</div>
          </div>
        </div>
        <button className="btn-ghost" onClick={fetchNewLeads} disabled={loading} style={{ padding: '6px 10px', fontSize: '12px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && (
        <div style={{
          padding: '9px 11px',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '13px',
          color: 'var(--danger)',
          background: 'rgba(255,71,87,0.1)',
          border: '1px solid rgba(255,71,87,0.3)'
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gap: '8px', maxHeight: '260px', overflow: 'auto' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px' }}>Loading leads...</div>
        ) : leads.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px' }}>No leads created yet.</div>
        ) : leads.map(lead => (
          <div key={lead.id} style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr 1.2fr auto',
            gap: '10px',
            alignItems: 'center',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px',
            background: 'var(--surface-2)'
          }}>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{lead.name}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                {formatLeadTime(lead.created_at)}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Assigned to:</div>
              <div style={{ color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 500 }}>
                {lead.assigned_to || 'Unassigned'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
              <QualityBadge quality={lead.lead_quality} />
              <FollowUpBadge status={lead.follow_up_status} />
            </div>
            <div>
              <button
                onClick={() => onViewLead(lead)}
                title="View/Edit Lead"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '6px',
                  borderRadius: '6px',
                  transition: 'all 0.1s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = 'var(--accent)'
                  e.currentTarget.style.background = 'var(--accent-muted)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'var(--text-muted)'
                  e.currentTarget.style.background = 'none'
                }}
              >
                <Eye size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, User } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Lead, Profile } from '@/types/lead'

interface UpcomingFollowUpsProps {
  currentProfile: Profile | null
  onViewLead: (lead: Lead) => void
}

function formatTime(dateStr: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(new Date(dateStr))
}

function getDayLabel(dateStr: string) {
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  
  const diffTime = date.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays === -1) return 'Yesterday (Overdue)'
  if (diffDays < -1) return `${Math.abs(diffDays)} Days Ago (Overdue)`
  
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

export function UpcomingFollowUps({ currentProfile, onViewLead }: UpcomingFollowUpsProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchFollowups = useCallback(async () => {
    if (!currentProfile) return
    
    setLoading(true)
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .not('next_followup_date', 'is', null)
        .order('next_followup_date', { ascending: true })
        .limit(50)

      // If regular user (non-admin), only show their follow-ups
      if (currentProfile.role !== 'admin') {
        query = query.eq('assigned_user_id', currentProfile.id)
      }

      const { data, error } = await query
      if (error) throw error
      setLeads((data as Lead[]) || [])
    } catch (err) {
      console.error('Error fetching followups:', err)
    } finally {
      setLoading(false)
    }
  }, [currentProfile, supabase])

  useEffect(() => {
    fetchFollowups()
  }, [fetchFollowups])

  // Group by day label
  const groupedLeads = leads.reduce((acc, lead) => {
    if (!lead.next_followup_date) return acc
    const label = getDayLabel(lead.next_followup_date)
    if (!acc[label]) acc[label] = []
    acc[label].push(lead)
    return acc
  }, {} as Record<string, Lead[]>)

  if (!currentProfile) return null

  return (
    <div className="crm-card" style={{ padding: '16px', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} color="var(--accent)" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Upcoming Follow-ups & Meetings</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Day-wise schedule</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
        {loading ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Loading schedule...</div>
        ) : leads.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No upcoming follow-ups scheduled.</div>
        ) : (
          Object.entries(groupedLeads).map(([dayLabel, dayLeads]) => (
            <div key={dayLabel} style={{ background: 'var(--bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ 
                fontSize: '13px', 
                fontWeight: 700, 
                color: dayLabel.includes('Overdue') ? 'var(--danger)' : 'var(--text-primary)', 
                marginBottom: '10px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '6px'
              }}>
                {dayLabel} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '11px', marginLeft: '6px' }}>({dayLeads.length})</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {dayLeads.map(lead => (
                  <div 
                    key={lead.id} 
                    onClick={() => onViewLead(lead)}
                    style={{ 
                      background: 'var(--surface)', 
                      padding: '10px', 
                      borderRadius: '6px', 
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'border-color 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{lead.name}</div>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-muted)', padding: '2px 6px', borderRadius: '4px' }}>
                        {lead.next_followup_date ? formatTime(lead.next_followup_date) : ''}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        {lead.follow_up_status ? lead.follow_up_status.replace('#', '').replace(/_/g, ' ') : 'Follow-up'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                        <User size={10} />
                        {lead.assigned_to || 'Unassigned'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

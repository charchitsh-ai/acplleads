'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, User, MessageSquare, ChevronDown, ChevronUp, RefreshCw, FileText } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface ActivityReportItem {
  id: string
  created_at: string
  activity_type: string
  remark: string
  created_by: string
  next_followup_date?: string
  leads: {
    name: string
  } | null
}

export default function DailyActivityReport() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const local = new Date()
    const offset = local.getTimezoneOffset()
    const adjusted = new Date(local.getTime() - offset * 60 * 1000)
    return adjusted.toISOString().split('T')[0]
  })
  const [activities, setActivities] = useState<ActivityReportItem[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const supabase = createClient()

  const fetchDailyActivities = useCallback(async () => {
    setLoading(true)
    try {
      // Get start and end of selected date in UTC
      const start = new Date(`${selectedDate}T00:00:00`)
      const end = new Date(`${selectedDate}T23:59:59.999`)

      const { data, error } = await supabase
        .from('lead_activities')
        .select(`
          id,
          created_at,
          activity_type,
          remark,
          created_by,
          next_followup_date,
          leads (
            name
          )
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error
      setActivities((data as any[]) || [])
    } catch (err) {
      console.error('Error fetching daily report:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedDate, supabase])

  useEffect(() => {
    fetchDailyActivities()
  }, [fetchDailyActivities])

  // Group activities by user (created_by)
  const groupedData = activities.reduce((acc, item) => {
    const userName = item.created_by || 'System/Unassigned'
    if (!acc[userName]) {
      acc[userName] = []
    }
    acc[userName].push(item)
    return acc
  }, {} as Record<string, ActivityReportItem[]>)

  const formatLocalTime = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(new Date(dateStr))
  }

  const formatFollowupDate = (dateStr?: string) => {
    if (!dateStr) return ''
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(dateStr))
  }

  return (
    <div className="crm-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--accent)" />
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>Daily Work Report</h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Track day-to-day remarks completed by callers</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="date"
            className="crm-input"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
          <button className="btn-ghost" onClick={fetchDailyActivities} disabled={loading} style={{ padding: '8px' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13.5px' }}>Loading daily report...</div>
      ) : Object.keys(groupedData).length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '8px', fontSize: '13.5px' }}>
          No work activity or remarks logged on this day.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {Object.entries(groupedData).map(([userName, items]) => {
            const isExpanded = expandedUser === userName
            const remarkCount = items.filter(i => i.activity_type === 'remark').length
            
            return (
              <div key={userName} style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface-2)' }}>
                {/* Header Row */}
                <button
                  onClick={() => setExpandedUser(isExpanded ? null : userName)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: 'transparent',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--text-primary)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: 'var(--accent-muted)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: '700'
                    }}>
                      <User size={15} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '600' }}>{userName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {items.length} activity logs • {remarkCount} remarks added
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{
                      fontSize: '11.5px',
                      fontWeight: '700',
                      background: 'var(--accent)',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {remarkCount} Remarks
                    </span>
                    {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                      {items.map(activity => (
                        <div
                          key={activity.id}
                          style={{
                            padding: '10px 12px',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            background: 'var(--surface-2)',
                            fontSize: '13px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                            <span style={{ fontWeight: '700', color: 'var(--accent)' }}>
                              🎯 {activity.leads?.name || 'Unknown Lead'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              🕒 {formatLocalTime(activity.created_at)}
                            </span>
                          </div>
                          
                          <div style={{ color: 'var(--text-primary)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                            {activity.remark}
                          </div>

                          {activity.next_followup_date && (
                            <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#ffa500', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
                              <span>📅 Next Follow-up:</span>
                              <span>{formatFollowupDate(activity.next_followup_date)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

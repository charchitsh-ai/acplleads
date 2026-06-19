'use client'

import { useCallback, useEffect, useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { Profile, UserActivityLog } from '@/types/lead'
import { createClient } from '@/utils/supabase/client'

interface UserActivityPanelProps {
  currentProfile: Profile | null
}

function formatLogTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function UserActivityPanel({ currentProfile }: UserActivityPanelProps) {
  const [logs, setLogs] = useState<UserActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const canView = currentProfile?.role === 'admin' || currentProfile?.role === 'manager'

  const fetchLogs = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    setError('')
    try {
      const { data, error } = await supabase
        .from('user_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error
      setLogs(data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [canView, supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLogs()
  }, [fetchLogs])

  if (!canView) return null

  return (
    <div className="crm-card" style={{ padding: '16px', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} color="var(--accent)" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>User Activity</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Login, logout, lead and assignment actions</div>
          </div>
        </div>
        <button className="btn-ghost" onClick={fetchLogs} disabled={loading} style={{ padding: '6px 10px', fontSize: '12px' }}>
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
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px' }}>Loading activity...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px' }}>No user activity yet.</div>
        ) : logs.map(log => (
          <div key={log.id} style={{
            display: 'grid',
            gridTemplateColumns: '150px 130px 1fr',
            gap: '10px',
            alignItems: 'start',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px',
            background: 'var(--surface-2)'
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{formatLogTime(log.created_at)}</div>
            <div>
              <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{log.actor_name || 'User'}</div>
              <span className="badge badge-followup">{log.activity_type.replace(/_/g, ' ')}</span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.45 }}>
              {log.detail}
              {log.lead_name && (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>Lead: {log.lead_name}</div>
              )}
              {log.target_user_name && (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '3px' }}>Target: {log.target_user_name}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

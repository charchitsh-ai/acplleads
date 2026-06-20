'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, LogOut, Edit2, Trash2, Filter, RefreshCw, ChevronLeft, ChevronRight, Clock3, LayoutDashboard, Users, FolderKanban, Upload, Flame, Zap, Snowflake, ClipboardList, Sparkles, Link2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { Lead, Profile } from '@/types/lead'
import { QualityBadge, FmBadge, FollowUpBadge, LeadStatusDot } from '@/components/Badges'
import LeadForm from '@/components/LeadForm'
import LeadActivityModal from '@/components/LeadActivityModal'
import LeadImportModal from '@/components/LeadImportModal'
import TeamManager from '@/components/TeamManager'
import UserActivityPanel from '@/components/UserActivityPanel'
import NewLeadsPanel from '@/components/NewLeadsPanel'
import SyncSourcesPanel from '@/components/SyncSourcesPanel'
import { UpcomingFollowUps } from '@/components/UpcomingFollowUps'
import { logUserActivity } from '@/utils/activity-log'
import { useRouter } from 'next/navigation'

const PAGE_SIZE = 1000

export const KANBAN_STAGES = [
  { title: 'New Lead', status: '#New_Lead', color: '#a3c026' },
  { title: 'First Call', status: '#First_Call', color: '#1e90ff' },
  { title: 'Follow-up 1', status: '#Followup_1', color: '#ffa500' },
  { title: 'Follow-up 2', status: '#Followup_2', color: '#ff6348' },
  { title: 'Meeting Scheduled', status: '#Meeting_Scheduled', color: '#3742fa' },
  { title: 'Virtual Meet', status: '#Virtual_Meet', color: '#7d5fff' },
  { title: 'Followup / Negotiate', status: '#Followup_Negotiate', color: '#ff9f43' },
  { title: 'In Person Meet', status: '#In_Person_Meet', color: '#2ed573' },
  { title: 'Followup Post In-Person', status: '#Followup_Post_Inperson', color: '#26de81' },
  { title: 'MOU', status: '#MOU', color: '#fd9644' },
  { title: 'Agreement', status: '#Agreement', color: '#20bf6b' },
  { title: 'Induction', status: '#Induction', color: '#45aaf2' },
  { title: 'Proposal Sent', status: '#Proposal_Sent', color: '#a55eea' },
  { title: 'Contacted', status: '#Contacted', color: '#ffa502' },
  { title: 'Lost / Closed', status: '#Lost', color: '#a4b0be' },
]

function formatLastActivity(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterQuality, setFilterQuality] = useState('')
  const [filterFm, setFilterFm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [page, setPage] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [activityLead, setActivityLead] = useState<Lead | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null)
  const [userLeadStats, setUserLeadStats] = useState<Record<string, { total: number; statusCounts: Record<string, number> }>>({})
  const [stats, setStats] = useState({ total: 0, hot: 0, warm: 0, cold: 0, today: 0 })
  const [stageStats, setStageStats] = useState<Record<string, number>>({})
  const [activeTab, setActiveTab] = useState<'dashboard' | 'team' | 'leads' | 'sync'>('dashboard')
  const [showImport, setShowImport] = useState(false)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [sortDateAsc, setSortDateAsc] = useState(false) // false = newest first (default)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
  const [dragLeadId, setDragLeadId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .order('s_no', { ascending: sortDateAsc, nullsFirst: false })
        .order('created_at', { ascending: sortDateAsc })

      if (search.trim()) {
        const s = search.trim()
        if (/^\d+$/.test(s)) {
          query = query.ilike('contact', `%${s}%`)
        } else {
          query = query.ilike('name', `%${s}%`)
        }
      }
      if (filterQuality) query = query.eq('lead_quality', filterQuality)
      if (filterFm) query = query.eq('fm_type', filterFm)
      if (filterStatus) query = query.eq('follow_up_status', filterStatus)
      if (filterMonth) {
        const start = new Date(`${filterMonth}-01T00:00:00Z`)
        const end = new Date(start)
        end.setMonth(end.getMonth() + 1)
        query = query.gte('created_at', start.toISOString()).lt('created_at', end.toISOString())
      }

      const { data, count, error } = await query
      if (error) throw error
      setLeads(data || [])
      setTotal(count || 0)
    } finally {
      setLoading(false)
    }
  }, [search, filterQuality, filterFm, filterStatus, filterMonth, sortDateAsc, supabase])

  const fetchStats = useCallback(async () => {
    const { count: total } = await supabase.from('leads').select('*', { count: 'exact', head: true })
    const { count: hot } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('lead_quality', '#Hot_Lead')
    const { count: warm } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('lead_quality', '#Warm_Lead')
    const { count: cold } = await supabase.from('leads').select('*', { count: 'exact', head: true }).eq('lead_quality', '#Cold_Lead')
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const { count: today } = await supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString())
    setStats({ total: total || 0, hot: hot || 0, warm: warm || 0, cold: cold || 0, today: today || 0 })

    const { data: stages } = await supabase.from('leads').select('follow_up_status')
    if (stages) {
      const counts: Record<string, number> = {}
      stages.forEach(l => {
        const s = l.follow_up_status || '#First_Call'
        counts[s] = (counts[s] || 0) + 1
      })
      setStageStats(counts)
    }
  }, [supabase])

  const fetchProfiles = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: me } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    setCurrentProfile(me || null)

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('display_name', { ascending: true })
    setProfiles(data || [])

    // Fetch lead stats for all users
    const { data: statsData, error: statsError } = await supabase
      .from('leads')
      .select('assigned_user_id, follow_up_status')

    if (!statsError && statsData) {
      const statsMap: Record<string, { total: number; statusCounts: Record<string, number> }> = {}
      statsData.forEach(lead => {
        const uid = lead.assigned_user_id
        if (!uid) return

        if (!statsMap[uid]) {
          statsMap[uid] = { total: 0, statusCounts: {} }
        }

        statsMap[uid].total++
        const status = lead.follow_up_status || '#First_Call'
        statsMap[uid].statusCounts[status] = (statsMap[uid].statusCounts[status] || 0) + 1
      })
      setUserLeadStats(statsMap)
    }
  }, [supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeads()
  }, [fetchLeads])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchStats()
  }, [fetchStats])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfiles()
  }, [fetchProfiles])

  // ── Supabase Realtime: auto-refresh when any lead changes ──────────────────
  useEffect(() => {
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          // New lead ayi, update hui, ya delete hui — sab cases me refresh
          fetchLeads()
          fetchStats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchLeads, fetchStats])

  // Reset page when filters change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0)
    setSelectedLeadIds([])
  }, [search, filterQuality, filterFm, filterStatus])

  const handleLogout = async () => {
    await logUserActivity(supabase, {
      activity_type: 'logout',
      detail: 'Logged out',
    })
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleDelete = async (id: string) => {
    const lead = leads.find(item => item.id === id)
    await supabase.from('leads').delete().eq('id', id)
    await logUserActivity(supabase, {
      activity_type: 'lead_deleted',
      lead_id: id,
      lead_name: lead?.name || null,
      detail: `Deleted lead: ${lead?.name || id}`,
    })
    setDeleteId(null)
    fetchLeads()
    fetchStats()
    fetchProfiles()
  }

  const handleSaved = () => {
    setShowForm(false)
    setEditLead(null)
    fetchLeads()
    fetchStats()
    fetchProfiles()
  }

  const handleAssignInline = async (leadId: string, leadName: string, userId: string) => {
    const profile = profiles.find(p => p.id === userId)
    const assignedTo = profile ? profile.display_name : 'Unassigned'
    const assignedUserId = userId || null

    const { error } = await supabase
      .from('leads')
      .update({
        assigned_user_id: assignedUserId,
        assigned_to: assignedTo,
        last_activity: new Date().toISOString()
      })
      .eq('id', leadId)

    if (error) {
      alert('Failed to assign lead: ' + error.message)
      return
    }

    await logUserActivity(supabase, {
      activity_type: 'lead_assigned',
      lead_id: leadId,
      lead_name: leadName,
      target_user_id: assignedUserId || undefined,
      target_user_name: assignedTo,
      detail: `Assigned lead "${leadName}" to ${assignedTo}`
    })

    fetchLeads()
    fetchProfiles()
  }

  const handleBulkAssign = async (userId: string) => {
    if (selectedLeadIds.length === 0) return
    const isUnassign = userId === 'unassign'
    const profile = isUnassign ? null : profiles.find(p => p.id === userId)
    const assignedTo = profile ? profile.display_name : 'Unassigned'
    const assignedUserId = profile ? profile.id : null

    setLoading(true)
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          assigned_user_id: assignedUserId,
          assigned_to: assignedTo,
          last_activity: new Date().toISOString()
        })
        .in('id', selectedLeadIds)

      if (error) throw error

      for (const leadId of selectedLeadIds) {
        const lead = leads.find(l => l.id === leadId)
        await logUserActivity(supabase, {
          activity_type: 'lead_assigned',
          lead_id: leadId,
          lead_name: lead?.name || null,
          target_user_id: assignedUserId || undefined,
          target_user_name: assignedTo,
          detail: `Lead "${lead?.name || leadId}" ${isUnassign ? 'unassigned' : `assigned to ${assignedTo}`} via bulk action`
        })
      }

      setSelectedLeadIds([])
      fetchLeads()
      fetchProfiles()
    } catch (err: any) {
      alert('Failed bulk assignment: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleKanbanDrop = async (newStatus: string) => {
    if (!dragLeadId || !newStatus) return
    const lead = leads.find(l => l.id === dragLeadId)
    if (!lead || lead.follow_up_status === newStatus) return
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === dragLeadId ? { ...l, follow_up_status: newStatus as Lead['follow_up_status'] } : l))
    const { error } = await supabase
      .from('leads')
      .update({ follow_up_status: newStatus, last_activity: new Date().toISOString() })
      .eq('id', dragLeadId)
    if (error) {
      // Revert on error
      fetchLeads()
      alert('Failed to move lead: ' + error.message)
    } else {
      await logUserActivity(supabase, {
        activity_type: 'lead_updated',
        lead_id: dragLeadId,
        lead_name: lead.name,
        detail: `Moved "${lead.name}" to ${newStatus.replace('#', '').replace(/_/g, ' ')}`
      })
    }
    setDragLeadId(null)
    setDragOverCol(null)
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div 
          className="mobile-only"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Sidebar Drawer */}
      <div style={{
        width: '260px',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 50,
        transform: showMobileMenu ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease-in-out',
      }} className="mobile-sidebar desktop-sidebar">
        <style>{`
          @media (min-width: 769px) {
            .desktop-sidebar { transform: translateX(0) !important; }
            .main-content { margin-left: 260px !important; }
          }
        `}</style>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px', padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: '38px', height: '38px',
            background: 'linear-gradient(135deg, var(--accent), #7fa01a)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '900', fontSize: '18px', color: 'white',
            boxShadow: '0 2px 8px rgba(163,192,38,0.4)'
          }}>A</div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>AYKA CRM</div>
            <div style={{ color: 'var(--accent)', fontSize: '10.5px', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Lead Manager</div>
          </div>
        </div>

        {/* Navigation Label */}
        <div style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', paddingLeft: '14px', marginBottom: '6px' }}>MENU</div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, padding: '0 10px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null, visible: true },
            { id: 'team', label: 'Team', icon: Users, badge: profiles.length > 0 ? profiles.length : null, visible: currentProfile?.role === 'admin' },
            { id: 'leads', label: 'Leads', icon: FolderKanban, badge: stats.total > 0 ? stats.total : null, visible: true },
            { id: 'sync', label: 'Sync Sources', icon: Link2, badge: null, visible: currentProfile?.role === 'admin' },
          ].filter(tab => tab.visible).map(tab => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setShowMobileMenu(false) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '11px',
                  padding: '10px 14px',
                  borderRadius: '9px',
                  border: 'none',
                  background: isActive ? 'var(--accent-muted)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isActive ? '700' : '500',
                  fontSize: '14px',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'all 0.15s ease',
                  borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                }}
              >
                <Icon size={17} />
                <span style={{ flex: 1 }}>{tab.label}</span>
                {tab.badge !== null && (
                  <span style={{
                    background: isActive ? 'var(--accent)' : 'var(--surface-2)',
                    color: isActive ? '#fff' : 'var(--text-muted)',
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '1px 7px',
                    borderRadius: '20px',
                    minWidth: '22px',
                    textAlign: 'center'
                  }}>{tab.badge}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Bottom Profile / Logout */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {currentProfile && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px',
              background: 'var(--surface-2)',
              borderRadius: '10px',
              border: '1px solid var(--border)'
            }}>
              <div style={{
                width: '34px', height: '34px',
                background: 'linear-gradient(135deg, var(--accent), #7fa01a)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '14px', fontWeight: '700', color: 'white',
                flexShrink: 0
              }}>
                {currentProfile.display_name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentProfile.display_name}</div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center',
                  fontSize: '10px', fontWeight: '700',
                  color: currentProfile.role === 'admin' ? '#ff4757' : currentProfile.role === 'manager' ? 'var(--accent)' : 'var(--text-muted)',
                  background: currentProfile.role === 'admin' ? 'rgba(255,71,87,0.1)' : currentProfile.role === 'manager' ? 'var(--accent-muted)' : 'var(--surface)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginTop: '2px'
                }}>{currentProfile.role}</div>
              </div>
            </div>
          )}
          <button className="btn-ghost" onClick={handleLogout} style={{ justifyContent: 'flex-start', padding: '9px 14px', fontSize: '13px', width: '100%', gap: '9px' }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content" style={{ flex: 1, padding: '20px', marginLeft: 0, transition: 'margin-left 0.3s' }}>
        
        {/* Mobile Header Toggle */}
        <div className="mobile-only-flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'var(--surface)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div style={{ fontWeight: '700', fontSize: '18px', color: 'var(--text-primary)' }}>AYKA CRM</div>
          <button onClick={() => setShowMobileMenu(true)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', padding: 0, color: 'var(--text-primary)' }}>☰</button>
        </div>

        <div style={{ width: '100%', margin: '0 auto' }}>
          {activeTab === 'dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>Dashboard</h1>
                  <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--text-muted)' }}>Overview of your sales pipeline and team activity.</p>
                </div>
                <button
                  className="btn-primary"
                  onClick={() => { setEditLead(null); setShowForm(true) }}
                  style={{ padding: '10px 18px', fontSize: '14px' }}
                >
                  <Plus size={16} /> New Lead
                </button>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '14px' }}>
                {[
                  { label: 'Total Leads', value: stats.total, color: 'var(--accent)', bg: 'var(--accent-muted)', Icon: ClipboardList },
                  { label: 'Added Today', value: stats.today, color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', Icon: Sparkles },
                  { label: 'Hot Leads', value: stats.hot, color: '#ff4757', bg: 'rgba(255,71,87,0.12)', Icon: Flame },
                  { label: 'Warm Leads', value: stats.warm, color: '#ffa502', bg: 'rgba(255,165,2,0.12)', Icon: Zap },
                  { label: 'Cold Leads', value: stats.cold, color: '#1e90ff', bg: 'rgba(30,144,255,0.12)', Icon: Snowflake },
                ].map(s => (
                  <div key={s.label} className="crm-card" style={{ padding: '20px', cursor: 'default' }}>
                    <div style={{
                      width: '36px', height: '36px',
                      background: s.bg,
                      borderRadius: '9px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: '12px'
                    }}>
                      <s.Icon size={18} color={s.color} strokeWidth={2} />
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Kanban Stage Grid */}
              <div style={{ marginTop: '8px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', marginBottom: '12px' }}>Pipeline Stages</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                  {KANBAN_STAGES.map(stage => {
                    const count = stageStats[stage.status] || 0
                    return (
                      <div key={stage.status} className="crm-card" style={{ padding: '12px 14px', borderLeft: `3px solid ${stage.color}` }}>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>{count}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 600 }}>{stage.title}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Activity + New Leads panels */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', alignItems: 'start' }}>
                <UpcomingFollowUps 
                  currentProfile={currentProfile} 
                  onViewLead={(lead: Lead) => {
                    setEditLead(lead)
                    setShowForm(true)
                  }}
                />
                <UserActivityPanel currentProfile={currentProfile} />
                <NewLeadsPanel
                  currentProfile={currentProfile}
                  onViewLead={(lead: Lead) => {
                    setEditLead(lead)
                    setShowForm(true)
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>Sync Sources</h1>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--text-muted)' }}>Auto-capture leads from Google Sheets via webhook.</p>
              </div>
              <SyncSourcesPanel />
            </div>
          )}

          {activeTab === 'team' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)' }}>Team Management</h1>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--text-muted)' }}>Manage user profiles, assign roles, and view statistics.</p>
              </div>
              <TeamManager currentProfile={currentProfile} profiles={profiles} leadStats={userLeadStats} onCreated={fetchProfiles} />
            </div>
          )}

          {activeTab === 'leads' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h1 style={{ margin: '0 0 4px', fontSize: '24px', color: 'var(--text-primary)' }}>Leads Management</h1>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Add, edit, filter, search, and assign CRM leads.</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <button onClick={() => setViewMode('list')} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', background: viewMode === 'list' ? 'var(--surface-2)' : 'transparent', color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>☰ List</button>
                    <button onClick={() => setViewMode('kanban')} style={{ padding: '6px 12px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: 'pointer', borderLeft: '1px solid var(--border)', background: viewMode === 'kanban' ? 'var(--surface-2)' : 'transparent', color: viewMode === 'kanban' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>⊞ Kanban</button>
                  </div>
                  <button className="btn-ghost" onClick={() => setShowImport(true)}>
                    <Upload size={16} /> Import CSV
                  </button>
                  <button className="btn-primary" onClick={() => { setEditLead(null); setShowForm(true) }}>
                    + Add Lead
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '320px' }}>
                  <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    className="crm-input"
                    style={{ paddingLeft: '32px' }}
                    placeholder="Search name or phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <select className="crm-input" style={{ width: 'auto', minWidth: '130px' }} value={filterQuality} onChange={e => setFilterQuality(e.target.value)}>
                  <option value="">All Quality</option>
                  <option value="#Hot_Lead">Hot Lead</option>
                  <option value="#Warm_Lead">Warm Lead</option>
                  <option value="#Cold_Lead">Cold Lead</option>
                  <option value="#Low_Potential">Low Potential</option>
                </select>
                <select className="crm-input" style={{ width: 'auto', minWidth: '110px' }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                  <option value="">All Months</option>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const d = new Date()
                    d.setDate(1)
                    d.setMonth(d.getMonth() - i)
                    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    const label = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(d)
                    return <option key={value} value={value}>{label}</option>
                  })}
                </select>
                <select className="crm-input" style={{ width: 'auto', minWidth: '110px' }} value={filterFm} onChange={e => setFilterFm(e.target.value)}>
                  <option value="">All FM Type</option>
                  <option value="CF">CF - City</option>
                  <option value="MF">MF - Master</option>
                  <option value="DF">DF - District</option>
                  <option value="SF">SF - State</option>
                  <option value="Collab">Collab</option>
                </select>
                <select className="crm-input" style={{ width: 'auto', minWidth: '140px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="#New_Lead">New Lead</option>
                  <option value="#First_Call">First Call</option>
                  <option value="#Followup_1">Follow-up 1</option>
                  <option value="#Followup_2">Follow-up 2</option>
                  <option value="#Meeting_Scheduled">Meeting Scheduled</option>
                  <option value="#Virtual_Meet">Virtual Meet</option>
                  <option value="#Followup_Negotiate">Followup / Negotiate</option>
                  <option value="#In_Person_Meet">In Person Meet</option>
                  <option value="#Followup_Post_Inperson">Followup Post In-Person</option>
                  <option value="#MOU">MOU</option>
                  <option value="#Agreement">Agreement</option>
                  <option value="#Induction">Induction</option>
                  <option value="#Proposal_Sent">Proposal Sent</option>
                  <option value="#Contacted">Contacted</option>
                  <option value="#Lost">Lost</option>
                </select>
                <button className="btn-ghost" onClick={fetchLeads} style={{ padding: '8px 10px' }}>
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* Bulk Actions Banner */}
              {selectedLeadIds.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--accent-muted)', border: '1px solid var(--accent)',
                  borderRadius: '8px', padding: '10px 16px', gap: '12px', flexWrap: 'wrap', marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--accent)' }}>
                    {selectedLeadIds.length} leads selected
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Assign selected to:</span>
                    <select
                      className="crm-input"
                      style={{ width: 'auto', minWidth: '150px', padding: '6px 12px' }}
                      value=""
                      onChange={e => { if (e.target.value) handleBulkAssign(e.target.value) }}
                    >
                      <option value="" disabled>Select Team Member...</option>
                      <option value="unassign">Unassign</option>
                      {profiles.map(p => (
                        <option key={p.id} value={p.id}>{p.display_name}</option>
                      ))}
                    </select>
                    <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={() => setSelectedLeadIds([])}>
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}

              {/* ── LIST VIEW ── */}
              {viewMode === 'list' ? (
                <div className="crm-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="table-container" style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', tableLayout: 'fixed', minWidth: '1000px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {[
                            { label: '', width: '4%' },
                            { label: 'S.No', width: '5%' },
                            { label: 'Name', width: '16%' },
                            { label: 'Contact', width: '10%' },
                            { label: 'Location', width: '12%' },
                            { label: 'Assigned', width: '12%' },
                            { label: 'FM Type', width: '7%' },
                            { label: 'Quality', width: '7%' },
                            { label: 'Follow-up', width: '9%' },
                            { label: 'Date', width: '9%' },
                            { label: 'Remark', width: '10%' },
                            { label: 'Actions', width: '7%' }
                          ].map((col, idx) => (
                            <th key={col.label || idx} style={{
                              padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600',
                              color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase',
                              whiteSpace: 'nowrap', width: col.width
                            }}>
                              {idx === 0 ? (
                                <input
                                  type="checkbox"
                                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                                  checked={leads.length > 0 && selectedLeadIds.length === leads.length}
                                  onChange={e => {
                                    if (e.target.checked) setSelectedLeadIds(leads.map(l => l.id))
                                    else setSelectedLeadIds([])
                                  }}
                                />
                              ) : col.label === 'Date' ? (
                                <button
                                  onClick={() => setSortDateAsc(prev => !prev)}
                                  title={sortDateAsc ? 'Oldest first — click for Newest first' : 'Newest first — click for Oldest first'}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--accent)', fontSize: '11px', fontWeight: '700',
                                    letterSpacing: '0.5px', textTransform: 'uppercase', padding: 0
                                  }}
                                >
                                  DATE <span style={{ fontSize: '13px', lineHeight: 1 }}>{sortDateAsc ? '↑' : '↓'}</span>
                                </button>
                              ) : col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={12} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading leads...</td></tr>
                        ) : leads.length === 0 ? (
                          <tr><td colSpan={12} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>No leads found. Add your first lead!</td></tr>
                        ) : leads.map((lead, i) => (
                          <tr key={lead.id} style={{
                            borderBottom: '1px solid var(--border)',
                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                            transition: 'background 0.1s'
                          }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)')}
                          >
                            <td style={{ padding: '8px 10px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="checkbox"
                                  style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                                  checked={selectedLeadIds.includes(lead.id)}
                                  onChange={e => {
                                    if (e.target.checked) setSelectedLeadIds(prev => [...prev, lead.id])
                                    else setSelectedLeadIds(prev => prev.filter(id => id !== lead.id))
                                  }}
                                />
                                <LeadStatusDot lead={lead} />
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden' }}>
                              {lead.s_no || '—'}
                            </td>
                            <td style={{ padding: '8px 10px', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: '500', fontSize: '13.5px', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }} title={lead.name}>
                                  {lead.name}
                                </span>
                                {lead.source && lead.source.includes(',') && (
                                  <span title={`Re-submitted via: ${lead.source}`} style={{ fontSize: '9px', background: 'rgba(255,165,2,0.15)', color: '#ffa502', padding: '1px 5px', borderRadius: '3px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>
                                    Re-sub
                                  </span>
                                )}
                              </div>
                              {lead.email && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={lead.email}>{lead.email}</div>}
                            </td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <span style={{ fontSize: '12.5px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{lead.contact || '—'}</span>
                            </td>
                            <td style={{ padding: '8px 10px', fontSize: '12.5px', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={[lead.city, lead.state].filter(Boolean).join(', ') || ''}>
                              {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                            </td>
                            <td style={{ padding: '8px 10px', overflow: 'hidden' }}>
                              <select
                                className="crm-input"
                                style={{ padding: '3px 6px', fontSize: '12px', border: '1px solid var(--border)', borderRadius: '5px', background: 'var(--surface)', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none', width: '100%', textOverflow: 'ellipsis' }}
                                value={lead.assigned_user_id || ''}
                                onChange={e => handleAssignInline(lead.id, lead.name, e.target.value)}
                              >
                                <option value="">Unassigned</option>
                                {profiles.map(p => (
                                  <option key={p.id} value={p.id}>{p.display_name}</option>
                                ))}
                              </select>
                            </td>
                            <td style={{ padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis' }}><FmBadge fmType={lead.fm_type} /></td>
                            <td style={{ padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis' }}><QualityBadge quality={lead.lead_quality} /></td>
                            <td style={{ padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis' }}><FollowUpBadge status={lead.follow_up_status} /></td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {lead.created_at && (
                                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{formatLastActivity(lead.created_at)}</div>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', overflow: 'hidden' }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={lead.last_remark || ''}>
                                {lead.last_remark || '—'}
                              </div>
                            </td>
                            <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button title="Activity history" onClick={() => setActivityLead(lead)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px', borderRadius: '5px', transition: 'all 0.1s' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--success)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(46,213,115,0.1)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}>
                                  <Clock3 size={13} />
                                </button>
                                <button onClick={() => { setEditLead(lead); setShowForm(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px', borderRadius: '5px', transition: 'all 0.1s' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-muted)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}>
                                  <Edit2 size={13} />
                                </button>
                                <button onClick={() => setDeleteId(lead.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '3px', borderRadius: '5px', transition: 'all 0.1s' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.1)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* ── KANBAN BOARD VIEW ── */
                <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '12px', alignItems: 'flex-start', minHeight: '600px' }}>
                  {KANBAN_STAGES.map(column => {
                    const colLeads = leads.filter(l => (l.follow_up_status || '#First_Call') === column.status)
                    const isDropTarget = dragOverCol === column.status && dragLeadId !== null
                    return (
                      <div
                        key={column.status}
                        onDragOver={e => { e.preventDefault(); setDragOverCol(column.status) }}
                        onDragLeave={() => setDragOverCol(null)}
                        onDrop={() => handleKanbanDrop(column.status)}
                        style={{
                          flex: '0 0 270px',
                          background: isDropTarget ? 'rgba(46,213,115,0.06)' : 'var(--surface)',
                          borderRadius: '12px',
                          border: isDropTarget ? '2px dashed #2ed573' : '1px solid var(--border)',
                          padding: isDropTarget ? '11px' : '12px',
                          display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '750px',
                          transition: 'background 0.15s, border 0.15s'
                        }}
                      >
                        {/* Column Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '2px solid ' + column.color }}>
                          <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: column.color, flexShrink: 0 }} />
                            {column.title}
                          </span>
                          <span style={{ fontSize: '11px', background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '20px', fontWeight: '700' }}>
                            {colLeads.length}
                          </span>
                        </div>
                        {/* Drop hint */}
                        {isDropTarget && (
                          <div style={{ padding: '10px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#2ed573', border: '1px dashed #2ed573', borderRadius: '8px', background: 'rgba(46,213,115,0.08)' }}>
                            Drop here → {column.title}
                          </div>
                        )}
                        {/* Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '2px' }}>
                          {colLeads.length === 0 && !isDropTarget ? (
                            <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                              No leads — drag a card here
                            </div>
                          ) : colLeads.map(lead => {
                            const isBeingDragged = dragLeadId === lead.id
                            return (
                            <div
                              key={lead.id}
                              draggable
                              onDragStart={e => {
                                setDragLeadId(lead.id)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', lead.id)
                              }}
                              onDragEnd={() => { setDragLeadId(null); setDragOverCol(null) }}
                              className="crm-card"
                              style={{
                                padding: '11px 12px',
                                border: '1px solid var(--border)',
                                borderRadius: '9px',
                                background: isBeingDragged ? 'var(--accent-muted)' : 'var(--surface-2)',
                                display: 'flex', flexDirection: 'column', gap: '7px',
                                cursor: 'grab',
                                opacity: isBeingDragged ? 0.5 : 1,
                                transition: 'opacity 0.15s, box-shadow 0.12s, transform 0.12s',
                                userSelect: 'none'
                              }}
                              onMouseEnter={e => { if (!isBeingDragged) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)' } }}
                              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)' }}>#{lead.s_no || '—'}</span>
                                <QualityBadge quality={lead.lead_quality} />
                              </div>
                              <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.3 }}>{lead.name}</div>
                              <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{lead.contact || 'No contact'}</div>
                              {lead.city && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  📍 {[lead.city, lead.state].filter(Boolean).join(', ')}
                                </div>
                              )}
                              {lead.fm_type && <FmBadge fmType={lead.fm_type} />}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  👤 <b>{lead.assigned_to || 'Unassigned'}</b>
                                </span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button title="Edit" onClick={e => { e.stopPropagation(); setEditLead(lead); setShowForm(true) }}
                                    style={{ background: 'none', border: 'none', padding: '3px', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'}
                                  ><Edit2 size={12} /></button>
                                  <button title="Activity" onClick={e => { e.stopPropagation(); setActivityLead(lead) }}
                                    style={{ background: 'none', border: 'none', padding: '3px', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '4px' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--success)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'}
                                  ><Clock3 size={12} /></button>
                                </div>
                              </div>
                            </div>
                          )})}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lead Form Modal */}
      {showForm && (
        <LeadForm
          lead={editLead}
          profiles={profiles}
          onClose={() => { setShowForm(false); setEditLead(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* Lead Import Modal */}
      {showImport && (
        <LeadImportModal
          profiles={profiles}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false)
            fetchLeads()
            fetchStats()
            fetchProfiles()
          }}
        />
      )}

      {activityLead && (
        <LeadActivityModal
          lead={activityLead}
          onClose={() => setActivityLead(null)}
          onChanged={() => {
            fetchLeads()
            fetchStats()
            fetchProfiles()
          }}
        />
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="crm-card" style={{ maxWidth: '320px', width: '100%', textAlign: 'center' }}>
            <div style={{
              width: '52px', height: '52px',
              background: 'rgba(255,71,87,0.12)',
              borderRadius: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <Trash2 size={24} color="var(--danger)" strokeWidth={1.8} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Delete Lead?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 20px' }}>
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


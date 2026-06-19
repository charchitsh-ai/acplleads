'use client'

import { useState } from 'react'
import { Plus, Users, Edit2, Trash2, Check, X, KeyRound } from 'lucide-react'
import { Profile, UserRole } from '@/types/lead'

interface TeamManagerProps {
  currentProfile: Profile | null
  profiles: Profile[]
  leadStats: Record<string, { total: number; statusCounts: Record<string, number> }>
  onCreated: () => void
}

const STATUS_META: Record<string, { label: string; emoji: string; color: string }> = {
  '#First_Call': { label: 'First Call', emoji: '📞', color: '#1e90ff' },
  '#Followup_1': { label: 'Follow-up 1', emoji: '🔄', color: '#ffa502' },
  '#Followup_2': { label: 'Follow-up 2', emoji: '🔁', color: '#ff7f50' },
  '#Meeting_Scheduled': { label: 'Meeting', emoji: '🤝', color: '#9b59b6' },
  '#Proposal_Sent': { label: 'Proposal', emoji: '📄', color: '#3498db' },
  '#Contacted': { label: 'Contacted', emoji: '💬', color: '#2ed573' },
  '#Lost': { label: 'Lost', emoji: '❌', color: '#ff4757' },
}

export default function TeamManager({ currentProfile, profiles, leadStats, onCreated }: TeamManagerProps) {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<UserRole>('user')
  const [editPassword, setEditPassword] = useState('')
  const [showPwField, setShowPwField] = useState(false)
  const [editLoading, setEditLoading] = useState(false)

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const isAdmin = currentProfile?.role === 'admin'
  const canCreate = currentProfile?.role === 'admin' || currentProfile?.role === 'manager'

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, email, password, role }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create user')
      setDisplayName('')
      setEmail('')
      setPassword('')
      setRole('user')
      setMessage('User created successfully!')
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (profile: Profile) => {
    setEditingId(profile.id)
    setEditName(profile.display_name)
    setEditRole(profile.role)
    setEditPassword('')
    setShowPwField(false)
    setError('')
    setMessage('')
  }

  const handleEdit = async (id: string) => {
    setEditLoading(true)
    setError('')
    try {
      const body: Record<string, unknown> = { id, display_name: editName, role: editRole }
      if (showPwField && editPassword.trim()) body.new_password = editPassword.trim()
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to update user')
      setMessage(showPwField && editPassword ? 'User updated & password changed!' : 'User updated successfully!')
      setEditingId(null)
      setEditPassword('')
      setShowPwField(false)
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeleteLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to delete user')
      setMessage('User deleted successfully!')
      setDeleteId(null)
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="crm-card" style={{ padding: '16px', marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} color="var(--accent)" />
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700 }}>Team &amp; Assignment</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {currentProfile ? `${currentProfile.display_name} - ${currentProfile.role}` : 'Profile not configured'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{profiles.length} users</div>
      </div>

      {canCreate && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.3fr 1fr 0.9fr auto',
          gap: '10px',
          alignItems: 'center',
          marginBottom: '18px'
        }}>
          <input className="crm-input" placeholder="Name" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          <input className="crm-input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="crm-input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <select className="crm-input" value={role} onChange={e => setRole(e.target.value as UserRole)}>
            <option value="user">User</option>
            <option value="manager">Manager</option>
            {currentProfile?.role === 'admin' && <option value="admin">Admin</option>}
          </select>
          <button className="btn-primary" onClick={handleCreate} disabled={loading}>
            <Plus size={14} /> {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {(message || error) && (
        <div style={{
          padding: '9px 11px',
          borderRadius: '8px',
          marginBottom: '12px',
          fontSize: '13px',
          color: error ? 'var(--danger)' : 'var(--success)',
          background: error ? 'rgba(255,71,87,0.1)' : 'rgba(46,213,115,0.1)',
          border: `1px solid ${error ? 'rgba(255,71,87,0.3)' : 'rgba(46,213,115,0.3)'}`
        }}>
          {error || message}
        </div>
      )}

      {/* Grid of Team Members */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {profiles.map(profile => {
          const stats = leadStats[profile.id] || { total: 0, statusCounts: {} }
          const isEditing = editingId === profile.id
          const isDeleting = deleteId === profile.id
          const isSelf = currentProfile?.id === profile.id

          return (
            <div key={profile.id} style={{
              border: `1px solid ${isEditing ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '12px',
              background: 'var(--surface-2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
              onMouseEnter={e => {
                if (!isEditing) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'
                }
              }}
              onMouseLeave={e => {
                if (!isEditing) {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = 'none'
                }
              }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                {isEditing ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <input
                      className="crm-input"
                      style={{ fontSize: '13px', padding: '4px 8px' }}
                      placeholder="Display Name"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                    />
                    {showPwField && (
                      <input
                        className="crm-input"
                        type="password"
                        style={{ fontSize: '13px', padding: '4px 8px' }}
                        placeholder="New Password (min 6 chars)"
                        value={editPassword}
                        onChange={e => setEditPassword(e.target.value)}
                      />
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{profile.display_name}</span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  {isEditing ? (
                    <>
                      <select
                        className="crm-input"
                        style={{ fontSize: '11px', padding: '3px 6px', width: 'auto' }}
                        value={editRole}
                        onChange={e => setEditRole(e.target.value as UserRole)}
                      >
                        <option value="user">User</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => setShowPwField(v => !v)}
                        title={showPwField ? 'Hide password field' : 'Change password'}
                        style={{
                          background: showPwField ? 'var(--accent-muted)' : 'none',
                          border: 'none', cursor: 'pointer',
                          color: showPwField ? 'var(--accent)' : 'var(--text-muted)',
                          padding: '4px', borderRadius: '5px',
                        }}
                      >
                        <KeyRound size={12} />
                      </button>
                    </>
                  ) : (
                    <span className="badge badge-fm" style={{ fontSize: '10px', padding: '1px 5px' }}>{profile.role}</span>
                  )}

                  {/* Admin-only edit & delete buttons */}
                  {isAdmin && !isSelf && (
                    <>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleEdit(profile.id)}
                            disabled={editLoading}
                            title="Save"
                            style={{
                              background: 'var(--accent-muted)', border: 'none', cursor: 'pointer',
                              color: 'var(--accent)', padding: '4px', borderRadius: '5px',
                            }}
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            title="Cancel"
                            style={{
                              background: 'rgba(255,71,87,0.1)', border: 'none', cursor: 'pointer',
                              color: 'var(--danger)', padding: '4px', borderRadius: '5px',
                            }}
                          >
                            <X size={13} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(profile)}
                            title="Edit user"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: '4px', borderRadius: '5px',
                              transition: 'all 0.1s'
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-muted)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => setDeleteId(profile.id)}
                            title="Delete user"
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text-muted)', padding: '4px', borderRadius: '5px',
                              transition: 'all 0.1s'
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,71,87,0.1)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{profile.email}</div>

              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                Total Leads: <strong style={{ color: 'var(--text-primary)' }}>{stats.total}</strong>
              </div>

              {stats.total > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
                  {Object.entries(STATUS_META).map(([statusKey, meta]) => {
                    const count = stats.statusCounts[statusKey] || 0
                    if (count === 0) return null
                    return (
                      <div key={statusKey} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: '5px',
                        padding: '2px 5px',
                        fontSize: '10px',
                        color: 'var(--text-secondary)'
                      }}>
                        <span>{meta.emoji}</span>
                        <span>{meta.label}:</span>
                        <strong style={{ color: meta.color }}>{count}</strong>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                  No leads assigned
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
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
            <h3 style={{ margin: '0 0 8px', fontSize: '16px' }}>Delete User?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 6px' }}>
              <strong>{profiles.find(p => p.id === deleteId)?.display_name}</strong>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 20px' }}>
              This will permanently delete the user and all their login access.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="btn-ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(deleteId)} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

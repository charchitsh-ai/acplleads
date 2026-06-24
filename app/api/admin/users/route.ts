import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { UserRole } from '@/types/lead'

const ALLOWED_ROLES: UserRole[] = ['admin', 'manager', 'user']

// ── POST: Create user ─────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: currentProfile, error: profileError } = await supabase
    .from('profiles').select('role,display_name,email').eq('id', user.id).single()

  if (profileError || !currentProfile || !['admin', 'manager'].includes(currentProfile.role)) {
    return NextResponse.json({ error: 'Only admins and managers can create users' }, { status: 403 })
  }

  const body = await request.json()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const displayName = String(body.display_name || '').trim()
  const role = String(body.role || 'user') as UserRole

  if (!email || !password || password.length < 6 || !displayName || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Name, valid email, password and role are required' }, { status: 400 })
  }

  if (currentProfile.role !== 'admin' && role === 'admin') {
    return NextResponse.json({ error: 'Only admins can create admin users' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName, role },
  })

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || 'Failed to create user' }, { status: 400 })
  }

  const { error: upsertError } = await admin.from('profiles').upsert({
    id: data.user.id,
    email,
    display_name: displayName,
    role,
    is_active: true,
  })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 })
  }

  await admin.from('user_activity_logs').insert({
    actor_id: user.id,
    actor_name: currentProfile.display_name || user.email || 'User',
    actor_email: currentProfile.email || user.email || null,
    activity_type: 'user_created',
    target_user_id: data.user.id,
    target_user_name: displayName,
    detail: `Created ${role} user: ${displayName} (${email})`,
  })

  return NextResponse.json({ user: { id: data.user.id, email, display_name: displayName, role, is_active: true } })
}

// ── PATCH: Edit user (display_name, role, password) ──────────────────────────
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: currentProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!currentProfile || currentProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can edit users' }, { status: 403 })
  }

  const body = await request.json()
  const { id, display_name, role, new_password } = body
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

  const admin = createAdminClient()

  // Update password in Supabase Auth if provided
  if (new_password) {
    if (String(new_password).length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }
    const { error: pwError } = await admin.auth.admin.updateUserById(id, {
      password: String(new_password),
    })
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 400 })
  }

  // Update profile fields
  const updates: Record<string, unknown> = {}
  if (display_name !== undefined) updates.display_name = String(display_name).trim()
  if (role !== undefined && ALLOWED_ROLES.includes(role)) updates.role = role

  if (Object.keys(updates).length > 0) {
    const { error } = await admin.from('profiles').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// ── DELETE: Remove user completely ───────────────────────────────────────────
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: currentProfile } = await supabase
    .from('profiles').select('role, display_name').eq('id', user.id).single()

  if (!currentProfile || currentProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Only admins can delete users' }, { status: 403 })
  }

  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
  if (id === user.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })

  const admin = createAdminClient()

  // Reassign all leads of the deleted user to the admin performing the deletion
  const { error: updateError } = await admin
    .from('leads')
    .update({ 
      assigned_user_id: user.id, 
      assigned_to: currentProfile.display_name || 'Admin' 
    })
    .eq('assigned_user_id', id)

  if (updateError) {
    return NextResponse.json({ error: `Failed to reassign leads: ${updateError.message}` }, { status: 400 })
  }

  const { error: authError } = await admin.auth.admin.deleteUser(id)
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  await admin.from('profiles').delete().eq('id', id)

  return NextResponse.json({ success: true })
}

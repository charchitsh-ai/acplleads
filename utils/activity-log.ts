import { SupabaseClient } from '@supabase/supabase-js'
import { UserActivityType } from '@/types/lead'

interface ActivityLogInput {
  activity_type: UserActivityType
  detail: string
  lead_id?: string | null
  lead_name?: string | null
  target_user_id?: string | null
  target_user_name?: string | null
}

export async function logUserActivity(supabase: SupabaseClient, input: ActivityLogInput) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name,email')
    .eq('id', user.id)
    .single()

  await supabase.from('user_activity_logs').insert({
    actor_id: user.id,
    actor_name: profile?.display_name || user.email || 'User',
    actor_email: profile?.email || user.email || null,
    ...input,
  })
}

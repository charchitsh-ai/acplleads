import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// GET - fetch SMTP config
export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('email_smtp_config')
      .select('*')
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return NextResponse.json({ config: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST - save SMTP config
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()

    const { data: existing } = await supabase
      .from('email_smtp_config')
      .select('id')
      .limit(1)
      .maybeSingle()

    let result
    if (existing?.id) {
      result = await supabase
        .from('email_smtp_config')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('email_smtp_config')
        .insert(body)
        .select()
        .single()
    }

    if (result.error) throw result.error
    return NextResponse.json({ success: true, config: result.data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save config'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

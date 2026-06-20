import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json({ templates: data || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch templates'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()
    const { data, error } = await supabase
      .from('email_templates')
      .insert({ name: body.name, subject: body.subject, body: body.body, description: body.description || '' })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ template: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create template'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await req.json()
    const { id, ...updates } = body
    const { data, error } = await supabase
      .from('email_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ template: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update template'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { id } = await req.json()
    const { error } = await supabase.from('email_templates').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete template'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

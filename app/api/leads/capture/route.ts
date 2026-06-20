import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Helper function to create supabase client at runtime
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase client is not configured')
  }
  return createClient(url, key)
}

const FM_MAP: Record<string, string> = {
  cf: 'CF', city: 'CF',
  mf: 'MF', master: 'MF',
  df: 'DF', district: 'DF',
  sf: 'SF', state: 'SF',
  collab: 'Collab',
}

const QUALITY_MAP: Record<string, string> = {
  hot: '#Hot_Lead',
  warm: '#Warm_Lead',
  cold: '#Cold_Lead',
  low: '#Low_Potential',
}

function normFm(val?: string) {
  if (!val) return undefined
  const v = val.toLowerCase().trim()
  if (v.includes('city') || v.includes('cf')) return 'CF'
  if (v.includes('master') || v.includes('mf')) return 'MF'
  if (v.includes('district') || v.includes('df')) return 'DF'
  if (v.includes('state') || v.includes('sf')) return 'SF'
  if (v.includes('collab')) return 'Collab'
  return undefined
}

function normQuality(val?: string) {
  if (!val) return undefined
  const v = val.toLowerCase()
  for (const [k, q] of Object.entries(QUALITY_MAP)) {
    if (v.includes(k)) return q
  }
  return undefined
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ──────────────────────────────────────────────────
    const authHeader = req.headers.get('x-capture-secret')
    const expectedSecret = process.env.LEADS_CAPTURE_SECRET

    if (!expectedSecret) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }
    if (authHeader !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse body ───────────────────────────────────────────────────
    const body = await req.json()

    // body can be a single lead object OR an array (batch)
    const leads = Array.isArray(body) ? body : [body]

    if (!leads.length) {
      return NextResponse.json({ error: 'No leads provided' }, { status: 400 })
    }

    // ── Map and validate each row ────────────────────────────────────
    const rows = leads
      .filter((l) => l.name && String(l.name).trim())  // name is required
      .map((l) => {
        let parsedCreatedAt: string | undefined = undefined
        const rawDate = l.created_at || l.timestamp || l.date
        if (rawDate) {
          const d = new Date(rawDate)
          if (!isNaN(d.getTime())) {
            parsedCreatedAt = d.toISOString()
          }
        }

        const row: any = {
          s_no:              l.s_no ? parseInt(String(l.s_no)) : null,
          name:              String(l.name).trim(),
          contact:           l.phone || l.contact || l.mobile || null,
          email:             l.email || null,
          city:              l.city || null,
          state:             l.state || null,
          occupation:        l.occupation || null,
          source:            l.source || 'Unknown',         // 'Website' or 'Facebook_Ads'
          assigned_to:       l.assigned_to || 'Unassigned',
          fm_type:           normFm(l.fm_type) ?? undefined,
          lead_quality:      normQuality(l.lead_quality) ?? '#Cold_Lead',
          follow_up_status:  l.follow_up_status || '#First_Call',
          last_remark:       l.remark || l.notes || l.message || null,
          lead_date:         parsedCreatedAt ? parsedCreatedAt.split('T')[0] : new Date().toISOString().split('T')[0],
        }

        if (parsedCreatedAt) {
          row.created_at = parsedCreatedAt
        }

        return row
      })

    if (!rows.length) {
      return NextResponse.json({ error: 'All rows missing required field: name' }, { status: 422 })
    }

    const supabase = getSupabaseClient()

    // ── Insert or update in Supabase (De-duplication) ────────────────
    const insertedIds: { id: string; name: string }[] = []
    const updatedIds: { id: string; name: string }[] = []

    const contacts = rows.map((r) => r.contact).filter(Boolean) as string[]
    const emails = rows.map((r) => r.email).filter(Boolean) as string[]

    let existingLeads: any[] = []
    if (contacts.length > 0 || emails.length > 0) {
      const filters = []
      if (contacts.length > 0) filters.push(`contact.in.(${contacts.map((c) => `"${c}"`).join(',')})`)
      if (emails.length > 0) filters.push(`email.in.(${emails.map((e) => `"${e}"`).join(',')})`)

      const { data: matched } = await supabase
        .from('leads')
        .select('*')
        .or(filters.join(','))

      if (matched) {
        existingLeads = matched
      }
    }

    const toInsert = []
    for (const row of rows) {
      const match = existingLeads.find(
        (el) =>
          (row.contact && el.contact === row.contact) ||
          (row.email && el.email && el.email.toLowerCase() === row.email.toLowerCase())
      )

      if (match) {
        // Merge source (e.g. "Facebook_Ads, Website")
        const updatedSource = match.source && !match.source.includes(row.source)
          ? `${match.source}, ${row.source}`
          : match.source

        // Prepend new remark to history
        const updatedRemark = row.last_remark
          ? (match.last_remark ? `${row.last_remark}\n---\n[Previous Remark]: ${match.last_remark}` : row.last_remark)
          : match.last_remark

        const { error: updErr } = await supabase
          .from('leads')
          .update({
            last_remark: updatedRemark,
            source: updatedSource,
            last_activity: new Date().toISOString(),
          })
          .eq('id', match.id)

        if (!updErr) {
          // Add details to activities table
          await supabase.from('lead_activities').insert({
            lead_id: match.id,
            activity_type: 'updated',
            remark: `Lead re-submitted via ${row.source}.${row.last_remark ? ` Remark: ${row.last_remark}` : ''}`,
            created_by: 'System'
          })
          updatedIds.push({ id: match.id, name: match.name })
        }
      } else {
        toInsert.push(row)
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insErr } = await supabase
        .from('leads')
        .insert(toInsert)
        .select('id, name')

      if (insErr) {
        console.error('[capture] Supabase insert error:', insErr)
        return NextResponse.json({ error: insErr.message }, { status: 500 })
      }
      if (inserted) {
        insertedIds.push(...inserted)
      }
    }

    return NextResponse.json({
      success: true,
      inserted: insertedIds.length,
      updated: updatedIds.length,
      leads: [...insertedIds, ...updatedIds],
    })
  } catch (err) {
    console.error('[capture] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Health-check (no auth needed — just confirms the endpoint is reachable)
export async function GET() {
  return NextResponse.json({ status: 'ok', endpoint: '/api/leads/capture' })
}

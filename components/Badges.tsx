import { Lead } from '@/types/lead'

const qualityMap: Record<string, { cls: string; label: string }> = {
  '#Hot_Lead':      { cls: 'badge-hot',  label: 'Hot' },
  '#Warm_Lead':     { cls: 'badge-warm', label: 'Warm' },
  '#Cold_Lead':     { cls: 'badge-cold', label: 'Cold' },
  '#Low_Potential': { cls: 'badge-low',  label: 'Low' },
}

const fmMap: Record<string, string> = {
  CF: 'City', MF: 'Master', DF: 'District', SF: 'State', Collab: 'Collab'
}

export function QualityBadge({ quality }: { quality?: string }) {
  if (!quality) return null
  const info = qualityMap[quality]
  if (!info) return null
  return <span className={`badge ${info.cls}`}>{info.label}</span>
}

export function FmBadge({ fmType }: { fmType?: string }) {
  if (!fmType) return null
  return <span className="badge badge-fm">{fmType} · {fmMap[fmType] || fmType}</span>
}

export function FollowUpBadge({ status }: { status?: string }) {
  if (!status) return null
  const label = status.replace('#', '').replace(/_/g, ' ')
  return <span className="badge badge-followup">{label}</span>
}

export function LeadStatusDot({ lead }: { lead: Lead }) {
  const remark = (lead.last_remark || '').toLowerCase()
  if (lead.lead_quality === '#Hot_Lead') return <span style={{ color: '#ff4757', fontSize: '8px' }}>●</span>
  if (remark.includes('not interested') || remark === 'invalid') return <span style={{ color: '#555c73', fontSize: '8px' }}>●</span>
  if (remark.includes('interested') || remark.includes('meeting') || remark.includes('gmeet')) return <span style={{ color: '#2ed573', fontSize: '8px' }}>●</span>
  return <span style={{ color: '#ffa502', fontSize: '8px' }}>●</span>
}

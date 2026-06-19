'use client'

import { useState } from 'react'
import { Globe, Share2, Check, AlertCircle, Copy, ExternalLink, Zap } from 'lucide-react'

export default function SyncSourcesPanel() {
  const [testing, setTesting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, 'ok' | 'error'>>({})
  const [copied, setCopied] = useState(false)

  const endpointUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/leads/capture`
    : '/api/leads/capture'

  const secret = 'ayka-crm-secret-2024'

  const copyEndpoint = () => {
    navigator.clipboard.writeText(endpointUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const testEndpoint = async () => {
    setTesting('health')
    try {
      const res = await fetch('/api/leads/capture')
      const data = await res.json()
      setResults(prev => ({ ...prev, health: data.status === 'ok' ? 'ok' : 'error' }))
    } catch {
      setResults(prev => ({ ...prev, health: 'error' }))
    } finally {
      setTesting(null)
    }
  }

  const sources = [
    {
      id: 'website',
      label: 'Website Leads',
      icon: Globe,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.12)',
      description: 'Leads from your website contact/inquiry form',
      script: 'google-apps-scripts/website-leads-script.js',
      defaultQuality: 'Cold',
      source: 'Website',
    },
    {
      id: 'meta',
      label: 'Meta / Facebook Ads',
      icon: Share2,
      color: '#1877f2',
      bg: 'rgba(24,119,242,0.12)',
      description: 'Leads from Facebook & Instagram Ad campaigns',
      script: 'google-apps-scripts/meta-leads-script.js',
      defaultQuality: 'Warm',
      source: 'Facebook_Ads',
    },
  ]

  return (
    <div className="crm-card" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px',
            background: 'var(--accent-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Zap size={17} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>Auto-Capture Sources</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Google Sheets → CRM via webhook</div>
          </div>
        </div>
        <button
          className="btn-ghost"
          onClick={testEndpoint}
          disabled={testing === 'health'}
          style={{ padding: '6px 12px', fontSize: '12px', gap: '6px' }}
        >
          {testing === 'health' ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Testing...</span>
          ) : results.health === 'ok' ? (
            <><Check size={13} color="var(--success)" /> Live</>
          ) : results.health === 'error' ? (
            <><AlertCircle size={13} color="var(--danger)" /> Error</>
          ) : (
            'Test Connection'
          )}
        </button>
      </div>

      {/* Endpoint URL */}
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '10px 14px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '3px' }}>Webhook Endpoint</div>
          <div style={{ fontSize: '12.5px', fontFamily: 'monospace', color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {endpointUrl}
          </div>
        </div>
        <button
          onClick={copyEndpoint}
          title="Copy endpoint URL"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: copied ? 'var(--success)' : 'var(--text-muted)',
            padding: '4px', borderRadius: '6px', flexShrink: 0,
            transition: 'color 0.15s'
          }}
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>

      {/* Source Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sources.map(src => {
          const Icon = src.icon
          return (
            <div key={src.id} style={{
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              background: 'var(--surface-2)'
            }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '9px',
                background: src.bg, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Icon size={18} color={src.color} strokeWidth={1.8} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', fontSize: '13.5px', color: 'var(--text-primary)' }}>{src.label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{src.description}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '10.5px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
                    background: 'var(--accent-muted)', color: 'var(--accent)'
                  }}>source: {src.source}</span>
                  <span style={{
                    fontSize: '10.5px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px',
                    background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
                    border: '1px solid var(--border)'
                  }}>default: {src.defaultQuality}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', fontWeight: '600',
                  color: 'var(--success)',
                  background: 'rgba(46,213,115,0.12)',
                  padding: '3px 8px', borderRadius: '20px'
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--success)',
                    display: 'inline-block',
                    animation: 'pulse 2s infinite'
                  }} />
                  Ready
                </span>
                <a
                  href={`/${src.script}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', color: 'var(--text-muted)',
                    textDecoration: 'none',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-primary)'
                    ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-muted)'
                    ;(e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
                  }}
                >
                  Script <ExternalLink size={11} />
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Setup hint */}
      <div style={{
        marginTop: '14px',
        padding: '10px 14px',
        background: 'rgba(163,192,38,0.08)',
        border: '1px solid rgba(163,192,38,0.25)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        lineHeight: 1.6
      }}>
        <strong style={{ color: 'var(--accent)' }}>Setup:</strong> Open each Google Sheet →{' '}
        <strong>Extensions → Apps Script</strong> → paste the script → run{' '}
        <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: '4px', fontSize: '11px' }}>setupTrigger</code>.
        New leads will appear here automatically.
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

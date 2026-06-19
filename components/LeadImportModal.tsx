'use client'

import { useState, useEffect } from 'react'
import { X, Upload, Check, AlertCircle, Play } from 'lucide-react'
import { Profile, LeadInsert, FmType, LeadQuality, FollowUpStatus } from '@/types/lead'
import { createClient } from '@/utils/supabase/client'
import { logUserActivity } from '@/utils/activity-log'

interface LeadImportModalProps {
  profiles: Profile[]
  onClose: () => void
  onImported: () => void
}

const DB_FIELDS: Array<{ key: keyof LeadInsert; label: string; required?: boolean }> = [
  { key: 'name', label: 'Lead Name *', required: true },
  { key: 'contact', label: 'Contact Number (Phone)' },
  { key: 'email', label: 'Email' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'occupation', label: 'Occupation' },
  { key: 'assigned_to', label: 'Assigned To (Name)' },
  { key: 'fm_type', label: 'FM Type (CF, MF, DF, SF, Collab)' },
  { key: 'lead_quality', label: 'Lead Quality (#Hot_Lead, #Warm_Lead...)' },
  { key: 'follow_up_status', label: 'Follow-up Status (#First_Call...)' },
  { key: 'last_remark', label: 'Last Remark / Notes' },
]

function parseCSV(text: string): string[][] {
  const lines: string[][] = []
  let row: string[] = []
  let inQuotes = false
  let currentVal = ''

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal.trim())
      currentVal = ''
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      row.push(currentVal.trim())
      if (row.some(val => val !== '')) {
        lines.push(row)
      }
      row = []
      currentVal = ''
    } else {
      currentVal += char
    }
  }
  if (currentVal || row.length > 0) {
    row.push(currentVal.trim())
    if (row.some(val => val !== '')) {
      lines.push(row)
    }
  }
  return lines
}

export default function LeadImportModal({ profiles, onClose, onImported }: LeadImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mappings, setMappings] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const supabase = createClient()

  // Auto detect mappings based on column names
  const autoDetectMappings = (parsedHeaders: string[]) => {
    const newMappings: Record<string, number> = {}
    parsedHeaders.forEach((header, index) => {
      const h = header.toLowerCase().replace(/[^a-z0-9]/g, '')
      if (h === 'name' || h === 'fullname' || h === 'leadname' || h === 'candidate') {
        newMappings['name'] = index
      } else if (h === 'phone' || h === 'contact' || h === 'mobile' || h === 'number' || h === 'phone_number') {
        newMappings['contact'] = index
      } else if (h === 'email' || h === 'mail' || h === 'emailaddress') {
        newMappings['email'] = index
      } else if (h === 'city' || h === 'town' || h === 'address') {
        newMappings['city'] = index
      } else if (h === 'state' || h === 'region') {
        newMappings['state'] = index
      } else if (h === 'occupation' || h === 'profession' || h === 'work') {
        newMappings['occupation'] = index
      } else if (h === 'assignedto' || h === 'assigned' || h === 'owner' || h === 'user') {
        newMappings['assigned_to'] = index
      } else if (h === 'fmtype' || h === 'fm' || h === 'franchise') {
        newMappings['fm_type'] = index
      } else if (h === 'quality' || h === 'leadquality' || h === 'priority') {
        newMappings['lead_quality'] = index
      } else if (h === 'status' || h === 'followupstatus' || h === 'followup') {
        newMappings['follow_up_status'] = index
      } else if (h === 'remark' || h === 'remarks' || h === 'note' || h === 'notes' || h === 'comment') {
        newMappings['last_remark'] = index
      }
    })
    setMappings(newMappings)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError('')
    setSuccess('')
    setHeaders([])
    setRows([])
    setMappings({})
    setLoading(true)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = parseCSV(text)
        if (parsed.length < 2) {
          throw new Error('CSV file is empty or does not have enough rows.')
        }
        const csvHeaders = parsed[0]
        const csvRows = parsed.slice(1)
        setHeaders(csvHeaders)
        setRows(csvRows)
        autoDetectMappings(csvHeaders)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to parse CSV file')
        setFile(null)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleMapChange = (fieldKey: string, indexStr: string) => {
    const index = indexStr === '' ? -1 : parseInt(indexStr, 10)
    setMappings(prev => {
      const next = { ...prev }
      if (index === -1) {
        delete next[fieldKey]
      } else {
        next[fieldKey] = index
      }
      return next
    })
  }

  // Standardize values
  const getFmType = (val?: string): FmType | undefined => {
    if (!val) return undefined
    const clean = val.toUpperCase().trim()
    if (['CF', 'MF', 'DF', 'SF', 'COLLAB'].includes(clean)) {
      return clean === 'COLLAB' ? 'Collab' : (clean as FmType)
    }
    return undefined
  }

  const getLeadQuality = (val?: string): LeadQuality | undefined => {
    if (!val) return undefined
    const clean = val.toLowerCase().trim()
    if (clean.includes('hot')) return '#Hot_Lead'
    if (clean.includes('warm')) return '#Warm_Lead'
    if (clean.includes('cold')) return '#Cold_Lead'
    if (clean.includes('low') || clean.includes('potential')) return '#Low_Potential'
    return undefined
  }

  const getFollowUpStatus = (val?: string): FollowUpStatus | undefined => {
    if (!val) return undefined
    const clean = val.toLowerCase().trim()
    if (clean.includes('first') || clean.includes('call')) return '#First_Call'
    if (clean.includes('followup 1') || clean.includes('followup_1') || clean.includes('follow-up 1')) return '#Followup_1'
    if (clean.includes('followup 2') || clean.includes('followup_2') || clean.includes('follow-up 2')) return '#Followup_2'
    if (clean.includes('meeting') || clean.includes('schedule')) return '#Meeting_Scheduled'
    if (clean.includes('proposal') || clean.includes('sent')) return '#Proposal_Sent'
    if (clean.includes('contacted')) return '#Contacted'
    if (clean.includes('lost')) return '#Lost'
    return undefined
  }

  const handleImport = async () => {
    if (!mappings['name'] === undefined) {
      setError('Lead Name mapping is required.')
      return
    }

    setImporting(true)
    setError('')
    setProgress({ current: 0, total: rows.length })

    const batchSize = 50
    const insertedLeads: LeadInsert[] = []

    // 1. Process and format all lead records
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r]
      const nameIndex = mappings['name']
      const name = nameIndex !== undefined ? row[nameIndex] : ''

      if (!name) continue // Skip rows with empty names

      // Resolve assigned user profiles if mapping assigned_to
      let assignedToName = 'Charchit'
      let assignedUserId: string | undefined = undefined

      const assignIndex = mappings['assigned_to']
      if (assignIndex !== undefined && row[assignIndex]) {
        const queryName = row[assignIndex].toLowerCase().trim()
        const matchedProfile = profiles.find(p => p.display_name.toLowerCase().includes(queryName) || p.email.toLowerCase().includes(queryName))
        if (matchedProfile) {
          assignedToName = matchedProfile.display_name
          assignedUserId = matchedProfile.id
        } else {
          assignedToName = row[assignIndex]
        }
      }

      const getVal = (key: keyof LeadInsert) => {
        const index = mappings[key as string]
        return index !== undefined ? row[index] : undefined
      }

      const leadRecord: LeadInsert = {
        name,
        contact: getVal('contact') || undefined,
        email: getVal('email') || undefined,
        city: getVal('city') || undefined,
        state: getVal('state') || undefined,
        occupation: getVal('occupation') || undefined,
        assigned_to: assignedToName || undefined,
        assigned_user_id: assignedUserId || undefined,
        fm_type: getFmType(getVal('fm_type')) || undefined,
        source: getVal('source') || 'Facebook_Ads',
        lead_quality: getLeadQuality(getVal('lead_quality')) || undefined,
        follow_up_status: getFollowUpStatus(getVal('follow_up_status')) || undefined,
        objection_tag: undefined,
        last_remark: getVal('last_remark') || undefined,
        lead_date: new Date().toISOString().split('T')[0],
      }
      insertedLeads.push(leadRecord)
    }

    // 2. Batch insert into Supabase
    try {
      let importedCount = 0
      for (let i = 0; i < insertedLeads.length; i += batchSize) {
        const batch = insertedLeads.slice(i, i + batchSize)
        const { error } = await supabase.from('leads').insert(batch)
        if (error) throw error

        importedCount += batch.length
        setProgress(prev => ({ ...prev, current: importedCount }))
      }

      // Log activity
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await logUserActivity(supabase, {
          activity_type: 'lead_created',
          detail: `Bulk imported ${insertedLeads.length} leads from CSV file "${file?.name}"`,
        })
      }

      setSuccess(`Successfully imported ${insertedLeads.length} leads!`)
      setFile(null)
      setHeaders([])
      setRows([])
      setMappings({})
      onImported()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Database error during bulk insert.')
    } finally {
      setImporting(false)
    }
  }

  // Pre-calculate preview of mapped objects (first 5 records)
  const getPreviewData = () => {
    return rows.slice(0, 5).map(row => {
      const record: Record<string, string> = {}
      DB_FIELDS.forEach(field => {
        const index = mappings[field.key as string]
        record[field.key] = index !== undefined && row[index] ? row[index] : '—'
      })
      return record
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px'
    }} onClick={e => e.target === e.currentTarget && !importing && onClose()}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)'
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Bulk Import Leads (CSV)
          </h2>
          <button onClick={onClose} disabled={importing} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)', padding: '4px'
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(255,71,87,0.1)',
              border: '1px solid rgba(255,71,87,0.3)',
              borderRadius: '8px', fontSize: '13px', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {success && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(46,213,115,0.1)',
              border: '1px solid rgba(46,213,115,0.3)',
              borderRadius: '8px', fontSize: '13px', color: 'var(--success)',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <Check size={15} /> {success}
            </div>
          )}

          {/* File Upload Selector */}
          {!file && !success && (
            <div style={{
              border: '2px dashed var(--border)',
              borderRadius: '12px',
              padding: '40px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              background: 'var(--surface-2)',
              transition: 'border-color 0.15s'
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              onClick={() => document.getElementById('csv-file-input')?.click()}
            >
              <Upload size={32} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>Choose a CSV File</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Click to select a .csv file from your computer</div>
              <input
                id="csv-file-input"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {loading && (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
              Parsing CSV file...
            </div>
          )}

          {/* Mappings & Preview UI */}
          {file && headers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* File Info */}
              <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between' }}>
                <span>File: <strong>{file.name}</strong></span>
                <span>Total records: <strong>{rows.length} leads</strong></span>
              </div>

              {/* Grid: Mappings */}
              <div>
                <h3 style={{ margin: '0 0 10px', fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  Map CSV Columns to Database Fields
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  background: 'var(--surface-2)',
                  padding: '14px',
                  borderRadius: '10px',
                  maxHeight: '260px',
                  overflow: 'auto',
                  border: '1px solid var(--border)'
                }}>
                  {DB_FIELDS.map(field => {
                    const currentIdx = mappings[field.key as string]
                    return (
                      <div key={field.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{field.label}</span>
                        <select
                          className="crm-input"
                          style={{ width: 'auto', minWidth: '150px', padding: '6px 10px', fontSize: '12.5px' }}
                          value={currentIdx !== undefined ? currentIdx : ''}
                          onChange={e => handleMapChange(field.key as string, e.target.value)}
                        >
                          <option value="">Don't Import</option>
                          {headers.map((header, idx) => (
                            <option key={idx} value={idx}>{header}</option>
                          ))}
                        </select>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Data Preview */}
              {Object.keys(mappings).length > 0 && (
                <div>
                  <h3 style={{ margin: '0 0 8px', fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Preview (First 5 Rows)
                  </h3>
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                          {DB_FIELDS.filter(f => mappings[f.key as string] !== undefined).map(f => (
                            <th key={f.key} style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{f.label.replace(' *', '')}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {getPreviewData().map((previewRow, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: '#ffffff' }}>
                            {DB_FIELDS.filter(f => mappings[f.key as string] !== undefined).map(f => (
                              <td key={f.key} style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{previewRow[f.key]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Progress state */}
          {importing && (
            <div style={{ padding: '20px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Importing leads...
              </div>
              <div style={{
                height: '8px',
                background: 'var(--surface-2)',
                borderRadius: '4px',
                overflow: 'hidden',
                maxWidth: '300px',
                margin: '0 auto 10px'
              }}>
                <div style={{
                  height: '100%',
                  background: 'var(--accent)',
                  width: `${(progress.current / progress.total) * 100}%`,
                  transition: 'width 0.1s ease'
                }} />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {progress.current} of {progress.total} imported
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: '10px',
          padding: '14px 20px',
          borderTop: '1px solid var(--border)'
        }}>
          <button className="btn-ghost" onClick={onClose} disabled={importing}>
            {success ? 'Close' : 'Cancel'}
          </button>
          {file && headers.length > 0 && !importing && (
            <button className="btn-primary" onClick={handleImport} disabled={mappings['name'] === undefined}>
              <Play size={14} /> Start Bulk Import
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

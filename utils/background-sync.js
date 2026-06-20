let googleLib;
try {
  googleLib = require('googleapis');
} catch (e) {
  console.error('[Sync] Could not load googleapis:', e.message);
}
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(process.cwd(), 'sync-state.json');

// Helper to get Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Normalized FM type mapping
function normFm(val) {
  if (!val) return undefined;
  const v = val.toLowerCase().trim();
  if (v.includes('city') || v.includes('cf')) return 'CF';
  if (v.includes('master') || v.includes('mf')) return 'MF';
  if (v.includes('district') || v.includes('df')) return 'DF';
  if (v.includes('state') || v.includes('sf')) return 'SF';
  if (v.includes('collab')) return 'Collab';
  return undefined;
}

// Helper to read sync state
async function getLastSyncedRow(supabase, sheetId) {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('sync_state')
        .select('last_synced_row')
        .eq('sheet_id', sheetId)
        .single();
      if (!error && data) return data.last_synced_row;
    }
  } catch (e) { /* suppress */ }

  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return state[sheetId] || 1;
    }
  } catch (e) {
    console.error('[Sync] Failed to read local sync state:', e);
  }
  return 1;
}

// Helper to save sync state
async function saveLastSyncedRow(supabase, sheetId, rowNum) {
  try {
    if (supabase) {
      const { error } = await supabase
        .from('sync_state')
        .upsert({ sheet_id: sheetId, last_synced_row: rowNum });
      if (!error) return;
    }
  } catch (e) { /* suppress */ }

  try {
    let state = {};
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    state[sheetId] = rowNum;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('[Sync] Failed to write local sync state:', e);
  }
}

async function processNewRows(supabase, sheetId, type, rows, startRow) {
  console.log(`[Sync] Processing ${rows.length} new rows for ${type} sheet starting at row ${startRow}`);

  const formattedRows = rows.map((rowArr, index) => {
    const rowNum = startRow + index;
    let parsedCreatedAt = undefined;

    if (type === 'website') {
      const rawDate = rowArr[1];
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) parsedCreatedAt = d.toISOString();
      }
      const firstName = String(rowArr[2] || '').trim();
      const lastName  = String(rowArr[3] || '').trim();
      const fullName  = (firstName + ' ' + lastName).trim() || 'Website Lead';

      return {
        s_no: parseInt(rowArr[0]) || rowNum,
        name: fullName,
        email: rowArr[4] ? String(rowArr[4]).trim() : null,
        contact: rowArr[5] ? String(rowArr[5]).trim() : null,
        city: rowArr[6] ? String(rowArr[6]).trim() : null,
        state: rowArr[7] ? String(rowArr[7]).trim() : null,
        fm_type: normFm(rowArr[8]),
        occupation: rowArr[9] ? String(rowArr[9]).trim() : null,
        last_remark: rowArr[10] ? String(rowArr[10]).trim() : null,
        source: 'Website',
        lead_quality: '#Cold_Lead',
        follow_up_status: '#First_Call',
        lead_date: parsedCreatedAt ? parsedCreatedAt.split('T')[0] : new Date().toISOString().split('T')[0],
        created_at: parsedCreatedAt || new Date().toISOString()
      };
    } else {
      // meta sheet
      const rawDate = rowArr[0];
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) parsedCreatedAt = d.toISOString();
      }
      const fullName = String(rowArr[14] || '').trim() || 'Meta Lead';

      return {
        s_no: rowNum,
        name: fullName,
        email: rowArr[15] ? String(rowArr[15]).trim() : null,
        contact: rowArr[16] ? String(rowArr[16]).trim() : null,
        city: rowArr[17] ? String(rowArr[17]).trim() : null,
        state: rowArr[18] ? String(rowArr[18]).trim() : null,
        fm_type: normFm(rowArr[13]),
        last_remark: rowArr[19] ? String(rowArr[19]).trim() : null,
        source: 'Facebook_Ads',
        lead_quality: '#Warm_Lead',
        follow_up_status: '#First_Call',
        lead_date: parsedCreatedAt ? parsedCreatedAt.split('T')[0] : new Date().toISOString().split('T')[0],
        created_at: parsedCreatedAt || new Date().toISOString()
      };
    }
  });

  for (const row of formattedRows) {
    if (!row.name || !row.name.trim()) continue;

    let matchedLead = null;
    if (row.contact || row.email) {
      const filters = [];
      if (row.contact) filters.push(`contact.eq.${row.contact}`);
      if (row.email)   filters.push(`email.eq.${row.email}`);

      const { data } = await supabase.from('leads').select('*').or(filters.join(','));
      if (data && data.length > 0) matchedLead = data[0];
    }

    if (matchedLead) {
      const updatedSource = matchedLead.source && !matchedLead.source.includes(row.source)
        ? `${matchedLead.source}, ${row.source}` : matchedLead.source;
      const updatedRemark = row.last_remark
        ? (matchedLead.last_remark ? `${row.last_remark}\n---\n[Previous]: ${matchedLead.last_remark}` : row.last_remark)
        : matchedLead.last_remark;

      const { error: updErr } = await supabase.from('leads').update({
        last_remark: updatedRemark,
        source: updatedSource,
        last_activity: new Date().toISOString(),
      }).eq('id', matchedLead.id);

      if (!updErr) {
        await supabase.from('lead_activities').insert({
          lead_id: matchedLead.id,
          activity_type: 'updated',
          remark: `Lead auto-synced & re-submitted via ${row.source}.`,
          created_by: 'System'
        });
        console.log(`[Sync] Updated existing lead: ${row.name}`);
      }
    } else {
      const { error: insErr } = await supabase.from('leads').insert(row).select('id');
      if (insErr) {
        console.error('[Sync] Error inserting lead:', insErr);
      } else {
        console.log(`[Sync] Inserted new lead: ${row.name}`);
      }
    }
  }
}

async function syncSheet(authClient, supabase, sheetConfig) {
  try {
    const google = googleLib ? googleLib.google : null;
    if (!google) { console.error('[Sync] googleapis not loaded'); return; }

    const { sheetId, tabName, type } = sheetConfig;
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const lastSynced = await getLastSyncedRow(supabase, sheetId);
    const range = `${tabName}!A${lastSynced + 1}:Z`;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });

    const rows = response.data.values;
    if (rows && rows.length > 0) {
      await processNewRows(supabase, sheetId, type, rows, lastSynced + 1);
      const newLastSynced = lastSynced + rows.length;
      await saveLastSyncedRow(supabase, sheetId, newLastSynced);
      console.log(`[Sync] Sheet "${type}" synced. New last_row: ${newLastSynced}`);
    } else {
      console.log(`[Sync] No new rows for "${type}" sheet`);
    }
  } catch (err) {
    if (err.message && err.message.includes('Unable to parse range')) {
      console.log(`[Sync] No new rows beyond index for "${sheetConfig.type}" sheet`);
    } else {
      console.error(`[Sync] Error syncing "${sheetConfig.type}" sheet:`, err.message);
    }
  }
}

let syncInterval = null;

function startBackgroundSync() {
  if (syncInterval) {
    console.log('[Sync] Background sync is already running.');
    return;
  }

  if (!googleLib) {
    console.error('[Sync] googleapis not available. Background sync disabled.');
    return;
  }
  const google = googleLib.google;

  // ── Load Google Service Account credentials ────────────────────────────────
  //
  //  RECOMMENDED: Set env var  GOOGLE_SERVICE_ACCOUNT_B64
  //               Value = base64 of your service-account JSON file
  //               Run this in PowerShell to get the value:
  //               [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\sa.json"))
  //
  //  FALLBACK:    GOOGLE_SERVICE_ACCOUNT_JSON = raw JSON (may fail on Hostinger)
  //
  let credentials;
  try {
    let parsed = null;
    const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const candidate = (b64 || raw || '').trim();

    if (!candidate) {
      console.warn('[Sync] No Google credentials env var found. Set GOOGLE_SERVICE_ACCOUNT_B64 or GOOGLE_SERVICE_ACCOUNT_JSON. Sync disabled.');
      return;
    }

    if (candidate.startsWith('{')) {
      // Raw JSON
      parsed = JSON.parse(candidate);
      console.log('[Sync] Credentials parsed directly from JSON ✓');
    } else {
      // Might be Base64
      try {
        const decoded = Buffer.from(candidate, 'base64').toString('utf8');
        if (decoded.trim().startsWith('{')) {
          parsed = JSON.parse(decoded);
          console.log('[Sync] Credentials decoded and parsed from Base64 ✓');
        } else {
          throw new Error('Decoded Base64 string is not valid JSON');
        }
      } catch (err) {
        // Fallback to trigger normal JSON.parse error if it's not base64 either
        parsed = JSON.parse(candidate);
      }
    }

    const { client_email, private_key } = parsed;
    if (!client_email || !private_key) {
      throw new Error('JSON is missing client_email or private_key fields.');
    }

    credentials = { client_email, private_key };
    console.log('[Sync] Google credentials ready. Email:', client_email);
  } catch (e) {
    console.error('[Sync] Failed to load Google credentials:', e.message);
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[Sync] Supabase environment variables missing. Sync disabled.');
    return;
  }

  const authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const SHEETS_TO_SYNC = [
    { sheetId: '1m82l8vZwmFo-9qt71Vw7av46ai4Jy-HulAOt_MPNQM4', tabName: 'Wesbite lead',   type: 'website' },
    { sheetId: '1P2fexhvaJgKjZxAmkJ3vUCvOLAToWIESaXw9ye_ido',  tabName: 'AYKA Life (v1)', type: 'meta'    },
  ];

  console.log('[Sync] Background sync started — polling every 15 seconds');

  syncInterval = setInterval(async () => {
    try {
      for (const sheetConfig of SHEETS_TO_SYNC) {
        await syncSheet(authClient, supabase, sheetConfig);
      }
    } catch (e) {
      console.error('[Sync] Fatal error in sync loop:', e.message);
    }
  }, 15000);
}

module.exports = { startBackgroundSync };

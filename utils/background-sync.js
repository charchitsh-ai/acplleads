const { google } = require('googleapis');
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

// Normalized quality mapping
function normQuality(val) {
  if (!val) return undefined;
  const v = val.toLowerCase();
  if (v.includes('hot')) return '#Hot_Lead';
  if (v.includes('warm')) return '#Warm_Lead';
  if (v.includes('cold')) return '#Cold_Lead';
  if (v.includes('low')) return '#Low_Potential';
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
      if (!error && data) {
        return data.last_synced_row;
      }
    }
  } catch (e) {
    // Suppress and fallback
  }

  // Fallback to local file
  try {
    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return state[sheetId] || 1;
    }
  } catch (e) {
    console.error('Failed to read local sync state:', e);
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
  } catch (e) {
    // Suppress and fallback
  }

  // Fallback to local file
  try {
    let state = {};
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
    state[sheetId] = rowNum;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write local sync state:', e);
  }
}

async function processNewRows(supabase, sheetId, type, rows, startRow) {
  console.log(`[Sync] Processing ${rows.length} new rows for ${type} sheet starting at row ${startRow}`);
  
  const formattedRows = rows.map((rowArr, index) => {
    const rowNum = startRow + index;
    let parsedCreatedAt = undefined;

    if (type === 'website') {
      // mapping:
      // data[1]: Date
      // data[2]: First name
      // data[3]: Last name
      // data[4]: Email
      // data[5]: Contact
      // data[6]: City
      // data[7]: State
      // data[8]: FM Type / Model
      // data[9]: Occupation
      // data[10]: Comment / Message
      const rawDate = rowArr[1];
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) parsedCreatedAt = d.toISOString();
      }

      const firstName = String(rowArr[2] || '').trim();
      const lastName = String(rowArr[3] || '').trim();
      const fullName = (firstName + ' ' + lastName).trim() || 'Website Lead';

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
      // mapping for meta sheet (AYKA Life (v1)):
      // H: 120244507923 (index 7)
      // I: Franchise LEAD (index 8)
      // J: 14186501620 (index 9)
      // K: AYKA Life (v1) (index 10)
      // L: false (index 11)
      // M: ig/fb (index 12)
      // N: model (index 13)
      // O: Full Name (index 14)
      // P: Email (index 15)
      // Q: Contact/Phone (index 16)
      // R: City (index 17)
      // S: State (index 18)
      // T: Occupation/Message (index 19)

      // Col A (index 0) is usually Timestamp
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

  // De-duplicate & insert/update in Supabase
  for (const row of formattedRows) {
    if (!row.name || !row.name.trim()) continue;

    // Check for existing by phone or email
    let matchedLead = null;
    if (row.contact || row.email) {
      const filters = [];
      if (row.contact) filters.push(`contact.eq.${row.contact}`);
      if (row.email) filters.push(`email.eq.${row.email}`);

      const { data } = await supabase
        .from('leads')
        .select('*')
        .or(filters.join(','));
      
      if (data && data.length > 0) {
        matchedLead = data[0];
      }
    }

    if (matchedLead) {
      // Lead exists -> Update it (Merge sources & append remarks)
      const updatedSource = matchedLead.source && !matchedLead.source.includes(row.source)
        ? `${matchedLead.source}, ${row.source}`
        : matchedLead.source;

      const updatedRemark = row.last_remark
        ? (matchedLead.last_remark ? `${row.last_remark}\n---\n[Previous Remark]: ${matchedLead.last_remark}` : row.last_remark)
        : matchedLead.last_remark;

      const { error: updErr } = await supabase
        .from('leads')
        .update({
          last_remark: updatedRemark,
          source: updatedSource,
          last_activity: new Date().toISOString(),
        })
        .eq('id', matchedLead.id);

      if (!updErr) {
        await supabase.from('lead_activities').insert({
          lead_id: matchedLead.id,
          activity_type: 'updated',
          remark: `Lead auto-synced & re-submitted via ${row.source}.${row.last_remark ? ` Remark: ${row.last_remark}` : ''}`,
          created_by: 'System'
        });
        console.log(`[Sync] Updated existing lead: ${row.name}`);
      }
    } else {
      // Lead does not exist -> Insert new lead
      const { data: inserted, error: insErr } = await supabase
        .from('leads')
        .insert(row)
        .select('id');

      if (insErr) {
        console.error('[Sync] Error inserting lead:', insErr);
      } else if (inserted && inserted.length > 0) {
        console.log(`[Sync] Inserted new lead: ${row.name}`);
      }
    }
  }
}

async function syncSheet(authClient, supabase, sheetConfig) {
  try {
    const { sheetId, tabName, type } = sheetConfig;
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Get last synced row
    const lastSynced = await getLastSyncedRow(supabase, sheetId);

    // We read starting from lastSynced + 1 (to catch new rows)
    const range = `${tabName}!A${lastSynced + 1}:Z`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range,
    });

    const rows = response.data.values;
    if (rows && rows.length > 0) {
      await processNewRows(supabase, sheetId, type, rows, lastSynced + 1);
      // Save new last synced row index
      const newLastSynced = lastSynced + rows.length;
      await saveLastSyncedRow(supabase, sheetId, newLastSynced);
      console.log(`[Sync] Sheet ${type} synced successfully. New last_synced_row: ${newLastSynced}`);
    } else {
      console.log(`[Sync] No new rows for ${type} sheet`);
    }
  } catch (err) {
    if (err.message && err.message.includes('Unable to parse range')) {
      // This usually means there are no rows beyond the current limit yet
      console.log(`[Sync] No new rows beyond index for ${sheetConfig.type} sheet`);
    } else {
      console.error(`[Sync] Error syncing ${sheetConfig.type} sheet:`, err.message);
    }
  }
}

let syncInterval = null;

function startBackgroundSync() {
  if (syncInterval) {
    console.log('[Sync] Background sync is already running.');
    return;
  }

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    console.warn('[Sync] GOOGLE_SERVICE_ACCOUNT_JSON not set. Background sync disabled.');
    return;
  }

  let credentials;
  try {
    // Regex to extract client_email
    const emailMatch = credentialsJson.match(/"client_email"\s*:\s*"([^"]+)"/);
    const client_email = emailMatch ? emailMatch[1].trim() : null;

    // Regex to extract private_key (which can contain multiple lines and escaped newlines)
    const keyMatch = credentialsJson.match(/"private_key"\s*:\s*"([\s\S]*?)"/);
    let private_key = keyMatch ? keyMatch[1] : null;

    if (!client_email || !private_key) {
      throw new Error('Could not find client_email or private_key in the provided JSON string.');
    }

    // Clean up private_key to guarantee standard PEM format
    let cleanKey = private_key;

    // 1. Remove standard headers/footers to isolate the raw base64 data
    cleanKey = cleanKey
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '');

    // 2. Remove escaped backslash-n, backslash-r, backslash-t and backslashes
    cleanKey = cleanKey
      .replace(/\\n/g, '')
      .replace(/\\r/g, '')
      .replace(/\\t/g, '')
      .replace(/\\/g, '');

    // 3. Strip all remaining whitespace, newlines, and quotes
    cleanKey = cleanKey.replace(/[\s\r\n"']/g, '');

    // 4. Reconstruct the PEM key with 64-character chunks per line
    const chunks = [];
    for (let i = 0; i < cleanKey.length; i += 64) {
      chunks.push(cleanKey.substring(i, i + 64));
    }
    const formattedPrivateKey = `-----BEGIN PRIVATE KEY-----\n${chunks.join('\n')}\n-----END PRIVATE KEY-----\n`;

    credentials = {
      client_email,
      private_key: formattedPrivateKey
    };

    console.log('[Sync] Credentials parsed and PEM key reconstructed successfully. Email:', client_email);
    console.log('[Sync] Reconstructed Key Details - Length:', formattedPrivateKey.length, 'Start:', formattedPrivateKey.substring(0, 40).replace(/\n/g, '[LF]'), 'End:', formattedPrivateKey.substring(formattedPrivateKey.length - 40).replace(/\n/g, '[LF]'));
  } catch (e) {
    console.error('[Sync] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON using Regex:', e.message);
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[Sync] Supabase environment variables missing. Background sync disabled.');
    return;
  }

  // Set up Google Auth Client
  const authClient = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const SHEETS_TO_SYNC = [
    {
      sheetId: '1m82l8vZwmFo-9qt71Vw7av46ai4Jy-HulAOt_MPNQM4',
      tabName: 'Wesbite lead',
      type: 'website'
    },
    {
      sheetId: '1P2fexhvaJgKjZxAmkJ3vUCvOLAToWIESaXw9ye_ido',
      tabName: 'AYKA Life (v1)',
      type: 'meta'
    }
  ];

  console.log('[Sync] Background sheets sync worker started (interval: 15 seconds)');

  syncInterval = setInterval(async () => {
    try {
      for (const sheetConfig of SHEETS_TO_SYNC) {
        await syncSheet(authClient, supabase, sheetConfig);
      }
    } catch (e) {
      console.error('[Sync] Fatal error in sync interval loop:', e.message);
    }
  }, 15000); // 15 seconds
}

module.exports = {
  startBackgroundSync
};

/**
 * AYKA Franchise CRM Lead Sync (Google Apps Script)
 * 
 * Centralized sync script to merge Website Leads and Meta Leads into a Master CRM sheet
 * with duplicate detection, color highlighting, age-based tag removal, automatic sorting,
 * logging, and dashboard summaries.
 * 
 * Installable Trigger:
 * Set up a time-driven trigger for `syncAllLeads` to run every 5 minutes.
 */

// ─── CONFIGURATION SECTION ──────────────────────────────────────────────────
const CONFIG = {
  MASTER_CRM_SHEET: "Master CRM",
  WEBSITE_LEADS_SHEET: "Wesbite lead", // Name of website leads sheet
  META_LEADS_SHEET: "AYKA Life (v1)",    // Name of meta leads sheet
  DASHBOARD_SHEET: "Dashboard",
  LOGS_SHEET: "Logs",
  
  // Highlighting Colors (Hex format)
  COLOR_GREEN: "#d4edda", // Light Green for New Leads
  COLOR_RED: "#f8d7da",   // Light Red for Duplicate Leads
  COLOR_RESET: "#ffffff", // Normal white background
};

// Column mappings for Master CRM (1-based index)
const CRM_COLS = {
  LEAD_DATE: 1,
  SOURCE: 2,
  FULL_NAME: 3,
  EMAIL: 4,
  PHONE: 5,
  CITY: 6,
  STATE: 7,
  FRANCHISE_MODEL: 8,
  OCCUPATION: 9,
  CAMPAIGN_NAME: 10,
  PLATFORM: 11,
  STATUS: 12,
  DUPLICATE: 13,
  NEW_LEAD_TAG: 14
};

/**
 * Main execution function triggered every 5 minutes
 */
function syncAllLeads() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  writeLogs("System", "All", "Sync process started");
  
  try {
    // 1. Initialize sheets if they don't exist
    initMasterCRM(ss);
    initLogsSheet(ss);
    initDashboardSheet(ss);
    
    // 2. Perform the syncs
    syncWebsiteLeads(ss);
    syncMetaLeads(ss);
    
    // 3. Clean up expired "NEW" tags (> 24 hours old)
    cleanExpiredNewTags(ss);
    
    // 4. Update the Dashboard counters
    updateDashboard(ss);
    
    writeLogs("System", "All", "Sync process completed successfully");
  } catch (err) {
    writeLogs("System", "Error", "Sync failed: " + err.toString());
    Logger.log("Sync failed: " + err.toString());
  }
}

/**
 * Initialize Master CRM Sheet with headers if empty
 */
function initMasterCRM(ss) {
  let sheet = ss.getSheetByName(CONFIG.MASTER_CRM_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.MASTER_CRM_SHEET);
    const headers = [
      "Lead Date", "Source", "Full Name", "Email", "Phone", "City", "State", 
      "Franchise Model", "Occupation", "Campaign Name", "Platform", "Status", 
      "Duplicate", "New Lead Tag"
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e9ecef");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Initialize Logs Sheet with headers if empty
 */
function initLogsSheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.LOGS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.LOGS_SHEET);
    const headers = ["Timestamp", "Source", "Lead Name", "Action"];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e9ecef");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * Initialize Dashboard Sheet with templates if empty
 */
function initDashboardSheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.DASHBOARD_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.DASHBOARD_SHEET);
    sheet.appendRow(["AYKA Franchise CRM Summary Dashboard"]);
    sheet.getRange("A1").setFontSize(16).setFontWeight("bold");
    sheet.appendRow([]);
    sheet.appendRow(["Metric", "Value"]);
    sheet.getRange("A3:B3").setFontWeight("bold").setBackground("#e9ecef");
  }
  return sheet;
}

/**
 * Sync Website Leads
 */
function syncWebsiteLeads(ss) {
  const sourceSheet = ss.getSheetByName(CONFIG.WEBSITE_LEADS_SHEET);
  if (!sourceSheet) {
    Logger.log("Website Leads sheet not found: " + CONFIG.WEBSITE_LEADS_SHEET);
    return;
  }
  
  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) return; // No data rows
  
  // Retrieve last processed row index to support 10,000+ optimized scanning
  const props = PropertiesService.getScriptProperties();
  const lastProcessed = parseInt(props.getProperty("LAST_ROW_WEBSITE") || "1");
  
  if (lastRow <= lastProcessed) {
    Logger.log("No new website leads to sync.");
    return;
  }
  
  const range = sourceSheet.getRange(lastProcessed + 1, 1, lastRow - lastProcessed, sourceSheet.getLastColumn());
  const data = range.getValues();
  
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    // Header Mapping: Date (0), First Name (1), Last Name (2), Email (3), Contact Number (4), City (5), State (6), Franchise Model (7), Current Occupation (8), Comment / Message (9)
    const rawDate = row[0];
    const firstName = String(row[1] || '').trim();
    const lastName = String(row[2] || '').trim();
    const fullName = (firstName + ' ' + lastName).trim();
    const email = String(row[3] || '').trim();
    const phone = String(row[4] || '').trim();
    const city = String(row[5] || '').trim();
    const state = String(row[6] || '').trim();
    const franchiseModel = String(row[7] || '').trim();
    const occupation = String(row[8] || '').trim();
    
    if (!fullName && !phone) continue; // Skip empty rows
    
    const leadDate = rawDate ? new Date(rawDate) : new Date();
    
    const lead = {
      leadDate: leadDate,
      source: "Website",
      fullName: fullName,
      email: email,
      phone: phone,
      city: city,
      state: state,
      franchiseModel: franchiseModel,
      occupation: occupation,
      campaignName: "",
      platform: "",
      status: "New"
    };
    
    addOrUpdateLead(ss, lead);
    count++;
  }
  
  props.setProperty("LAST_ROW_WEBSITE", lastRow.toString());
  writeLogs("Website", "Multiple", "Synced " + count + " new website leads");
}

/**
 * Sync Meta Leads
 */
function syncMetaLeads(ss) {
  const sourceSheet = ss.getSheetByName(CONFIG.META_LEADS_SHEET);
  if (!sourceSheet) {
    Logger.log("Meta Leads sheet not found: " + CONFIG.META_LEADS_SHEET);
    return;
  }
  
  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) return; // No data rows
  
  const props = PropertiesService.getScriptProperties();
  const lastProcessed = parseInt(props.getProperty("LAST_ROW_META") || "1");
  
  if (lastRow <= lastProcessed) {
    Logger.log("No new Meta leads to sync.");
    return;
  }
  
  // Headers: campaign_id (0), campaign_name (1), form_id (2), form_name (3), is_organic (4), platform (5), which_franchise_opportunity_are_you_interested_in? (6), full_name (7), email (8), phone (9), city (10), state (11), job_title (12), lead_status (13)
  const range = sourceSheet.getRange(lastProcessed + 1, 1, lastRow - lastProcessed, sourceSheet.getLastColumn());
  const data = range.getValues();
  
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    const campaignName = String(row[1] || '').trim();
    const platform = String(row[5] || '').trim();
    const franchiseModel = String(row[6] || '').trim();
    const fullName = String(row[7] || '').trim();
    const email = String(row[8] || '').trim();
    const phone = String(row[9] || '').trim();
    const city = String(row[10] || '').trim();
    const state = String(row[11] || '').trim();
    const occupation = String(row[12] || '').trim();
    const status = String(row[13] || '').trim();
    
    if (!fullName && !phone) continue; // Skip empty rows
    
    const lead = {
      leadDate: new Date(), // Script execution date as per mapping rules
      source: "Meta",
      fullName: fullName,
      email: email,
      phone: phone,
      city: city,
      state: state,
      franchiseModel: franchiseModel,
      occupation: occupation,
      campaignName: campaignName,
      platform: platform,
      status: status || "New"
    };
    
    addOrUpdateLead(ss, lead);
    count++;
  }
  
  props.setProperty("LAST_ROW_META", lastRow.toString());
  writeLogs("Meta", "Multiple", "Synced " + count + " new Meta leads");
}

/**
 * Check duplicate and insert/update lead
 */
function addOrUpdateLead(ss, lead) {
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_CRM_SHEET);
  const data = masterSheet.getDataRange().getValues();
  
  let duplicateIndex = -1;
  
  // Duplicate priority: 1. Phone, 2. Email
  if (lead.phone || lead.email) {
    for (let i = 1; i < data.length; i++) {
      const dbPhone = String(data[i][CRM_COLS.PHONE - 1] || '').trim();
      const dbEmail = String(data[i][CRM_COLS.EMAIL - 1] || '').trim().toLowerCase();
      
      const matchPhone = lead.phone && dbPhone === lead.phone;
      const matchEmail = lead.email && dbEmail === lead.email.toLowerCase();
      
      if (matchPhone || matchEmail) {
        duplicateIndex = i + 1; // 1-based index (including header)
        break;
      }
    }
  }
  
  const timestamp = new Date().toISOString();
  
  if (duplicateIndex !== -1) {
    // ── Update Duplicate Lead ──
    masterSheet.getRange(duplicateIndex, CRM_COLS.DUPLICATE).setValue("YES");
    masterSheet.getRange(duplicateIndex, 1, 1, masterSheet.getLastColumn()).setBackground(CONFIG.COLOR_RED);
    
    writeLogs(lead.source, lead.fullName, "Duplicate Found & Updated (Row " + duplicateIndex + ")");
  } else {
    // ── Insert Fresh Lead ──
    const newRow = [];
    newRow[CRM_COLS.LEAD_DATE - 1] = Utilities.formatDate(lead.leadDate, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    newRow[CRM_COLS.SOURCE - 1] = lead.source;
    newRow[CRM_COLS.FULL_NAME - 1] = lead.fullName;
    newRow[CRM_COLS.EMAIL - 1] = lead.email;
    newRow[CRM_COLS.PHONE - 1] = lead.phone;
    newRow[CRM_COLS.CITY - 1] = lead.city;
    newRow[CRM_COLS.STATE - 1] = lead.state;
    newRow[CRM_COLS.FRANCHISE_MODEL - 1] = lead.franchiseModel;
    newRow[CRM_COLS.OCCUPATION - 1] = lead.occupation;
    newRow[CRM_COLS.CAMPAIGN_NAME - 1] = lead.campaignName;
    newRow[CRM_COLS.PLATFORM - 1] = lead.platform;
    newRow[CRM_COLS.STATUS - 1] = lead.status;
    newRow[CRM_COLS.DUPLICATE - 1] = "NO";
    newRow[CRM_COLS.NEW_LEAD_TAG - 1] = "NEW";
    
    masterSheet.appendRow(newRow);
    
    // Set cell background and note timestamp for 24 hours expiry checking
    const insertedRowIdx = masterSheet.getLastRow();
    const tagRange = masterSheet.getRange(insertedRowIdx, CRM_COLS.NEW_LEAD_TAG);
    tagRange.setNote(timestamp);
    
    masterSheet.getRange(insertedRowIdx, 1, 1, CRM_COLS.NEW_LEAD_TAG).setBackground(CONFIG.COLOR_GREEN);
    
    // Automatically sort the CRM descending by Lead Date
    sortCRM(masterSheet);
    
    writeLogs(lead.source, lead.fullName, "New Lead Added");
  }
}

/**
 * Sort Master CRM by Lead Date Descending (Newest first)
 */
function sortCRM(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).sort({ column: CRM_COLS.LEAD_DATE, ascending: false });
}

/**
 * Clean up expired NEW tags after 24 hours
 */
function cleanExpiredNewTags(ss) {
  const sheet = ss.getSheetByName(CONFIG.MASTER_CRM_SHEET);
  if (!sheet) return;
  
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const tagsRange = sheet.getRange(2, CRM_COLS.NEW_LEAD_TAG, lastRow - 1, 1);
  const tags = tagsRange.getValues();
  const notes = tagsRange.getNotes();
  const now = new Date().getTime();
  
  let clearedCount = 0;
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i][0];
    const timestampStr = notes[i][0];
    
    if (tag === "NEW" && timestampStr) {
      const tagTime = new Date(timestampStr).getTime();
      const elapsedHours = (now - tagTime) / (1000 * 60 * 60);
      
      if (elapsedHours >= 24) {
        const rowNum = i + 2;
        // Remove NEW tag and clear cell note
        sheet.getRange(rowNum, CRM_COLS.NEW_LEAD_TAG).setValue("").setNote("");
        
        // Restore row background color to white (unless it was marked duplicate)
        const isDuplicate = sheet.getRange(rowNum, CRM_COLS.DUPLICATE).getValue();
        if (isDuplicate !== "YES") {
          sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).setBackground(CONFIG.COLOR_RESET);
        }
        clearedCount++;
      }
    }
  }
  
  if (clearedCount > 0) {
    writeLogs("System", "All", "Cleared " + clearedCount + " expired 'NEW' tags");
  }
}

/**
 * Generate summaries and update Dashboard Sheet
 */
function updateDashboard(ss) {
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_CRM_SHEET);
  const dashSheet = ss.getSheetByName(CONFIG.DASHBOARD_SHEET);
  if (!masterSheet || !dashSheet) return;
  
  const data = masterSheet.getDataRange().getValues();
  
  let totalLeads = 0;
  let websiteLeads = 0;
  let metaLeads = 0;
  let todayLeads = 0;
  let duplicateLeads = 0;
  
  const cityCounts = {};
  const modelCounts = {};
  
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const leadDateStr = String(row[CRM_COLS.LEAD_DATE - 1] || '');
    const source = row[CRM_COLS.SOURCE - 1];
    const city = String(row[CRM_COLS.CITY - 1] || 'Unknown').trim();
    const model = String(row[CRM_COLS.FRANCHISE_MODEL - 1] || 'Unknown').trim();
    const isDuplicate = row[CRM_COLS.DUPLICATE - 1];
    
    totalLeads++;
    if (source === "Website") websiteLeads++;
    if (source === "Meta") metaLeads++;
    if (isDuplicate === "YES") duplicateLeads++;
    if (leadDateStr.startsWith(todayStr)) todayLeads++;
    
    if (city) cityCounts[city] = (cityCounts[city] || 0) + 1;
    if (model) modelCounts[model] = (modelCounts[model] || 0) + 1;
  }
  
  // Clear old dashboard data starting from row 4
  const lastRow = dashSheet.getLastRow();
  if (lastRow >= 4) {
    dashSheet.getRange(4, 1, lastRow - 3, 2).clearContent();
  }
  
  // Write general metrics
  const metrics = [
    ["Total Leads", totalLeads],
    ["Website Leads", websiteLeads],
    ["Meta Leads", metaLeads],
    ["Today's Leads", todayLeads],
    ["Duplicate Leads", duplicateLeads],
    [],
    ["City-wise Breakdown", ""],
  ];
  
  // Append cities
  Object.keys(cityCounts).sort().forEach(city => {
    metrics.push([city, cityCounts[city]]);
  });
  
  metrics.push([]);
  metrics.push(["Franchise Model-wise Breakdown", ""]);
  
  // Append models
  Object.keys(modelCounts).sort().forEach(model => {
    metrics.push([model, modelCounts[model]]);
  });
  
  // Insert metrics
  dashSheet.getRange(4, 1, metrics.length, 2).setValues(metrics);
  
  // Style breakdowns headings
  const dataRange = dashSheet.getRange(4, 1, metrics.length, 2).getValues();
  for (let i = 0; i < dataRange.length; i++) {
    const label = dataRange[i][0];
    if (label.includes("Breakdown")) {
      dashSheet.getRange(i + 4, 1, 1, 2).setFontWeight("bold").setBackground("#f1f3f5");
    }
  }
}

/**
 * Write Logs helper
 */
function writeLogs(source, leadName, action) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.LOGS_SHEET);
  if (!sheet) return;
  
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([timestamp, source, leadName, action]);
  
  // Keep logs trimmed to last 2000 rows to prevent slow down
  const lastRow = sheet.getLastRow();
  if (lastRow > 2000) {
    sheet.deleteRows(2, lastRow - 2000);
  }
}

/**
 * Reset row processing pointer to re-sync full history if needed
 */
function resetSyncPointers() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("LAST_ROW_WEBSITE");
  props.deleteProperty("LAST_ROW_META");
  Logger.log("Sync pointers reset.");
}

/**
 * Install the 5-minute time trigger programmatically
 */
function createSyncTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncAllLeads") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  
  ScriptApp.newTrigger("syncAllLeads")
    .timeBased()
    .everyMinutes(5)
    .create();
  
  Logger.log("Trigger created successfully.");
}

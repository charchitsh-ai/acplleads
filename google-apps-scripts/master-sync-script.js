/**
 * AYKA Centralized CRM Lead Sync (Master Sheet Version)
 * 
 * Paste this script in your Master Sheet (AYKA_All_Leads_AYKA_Alliance).
 * It pulls new leads from the Website Sheet and Meta Sheet, performs duplicate checks,
 * appends new leads with incremental S.No and timestamp, and pushes them to the CRM API.
 */

// ─── CONFIGURATION SECTION ──────────────────────────────────────────────────
const CONFIG = {
  // 1. Spreadsheet IDs
  WEBSITE_SPREADSHEET_ID: "1m82l8vZwmFo-9qt71Vw7av46ai4Jy-HulAOt_MPNQM4", // Franchise_AYKA Care Applications
  META_SPREADSHEET_ID: "1P2fexhvaJgKjZxAmkJ3vUCvOLAToWIESaXw9ye_ido",    // New AYKA LIFE_Meta ad

  // 2. Tab Names inside those spreadsheets
  WEBSITE_SHEET_NAME: "Sheet1",      // Website sheet tab name
  META_SHEET_NAME: "AYKA Life (v1)", // Meta sheet tab name
  MASTER_SHEET_NAME: "All Leads",    // Active Master Sheet tab name

  // 3. CRM API Endpoint
  CRM_ENDPOINT: "https://aykacare.co.in/api/leads/capture",
  CAPTURE_SECRET: "ayka-crm-secret-2024"
};

// Website Leads Sheet Column Indices (1-based index)
const WEB_COLS = {
  DATE: 1,             // Col A
  FIRST_NAME: 2,       // Col B
  LAST_NAME: 3,        // Col C
  EMAIL: 4,            // Col D
  CONTACT_NUMBER: 5,   // Col E
  CITY: 6,             // Col F
  STATE: 7,            // Col G
  FRANCHISE_MODEL: 8,  // Col H
  OCCUPATION: 9,       // Col I
  COMMENT_MESSAGE: 10  // Col J
};

// Meta Leads Sheet Column Indices (1-based index)
const META_COLS = {
  CREATED_TIME: 2,     // Col B
  CAMPAIGN_NAME: 8,    // Col H
  PLATFORM: 12,        // Col L
  FRANCHISE_MODEL: 13, // Col M
  FULL_NAME: 14,       // Col N
  EMAIL: 15,           // Col O
  PHONE: 16,           // Col P
  CITY: 17,            // Col Q
  STATE: 18,           // Col R
  JOB_TITLE: 19,       // Col S
  LEAD_STATUS: 20      // Col T
};

// Master CRM Column Indices (1-based index)
const CRM_COLS = {
  S_NO: 1,             // Col A
  NAME: 2,             // Col B
  CITY: 3,             // Col C
  STATE: 4,            // Col D
  OCCUPATION: 5,       // Col E
  ASSIGNED_TO: 6,      // Col F
  FBDM: 7,             // Col G
  FM_TYPE: 8,          // Col H
  CONTACT: 9,          // Col I (Phone)
  EMAIL: 10,           // Col J
  SOURCE: 11,          // Col K
  LEAD_QUALITY: 12,    // Col L
  FOLLOW_UP_STATUS: 13,// Col M
  OBJECTION_TAG: 14,   // Col N
  LAST_REMARK: 15,     // Col O
  LAST_ACTIVITY: 16    // Col P (Date/Time)
};

/**
 * Main Sync Function
 */
function syncAllLeads() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName(CONFIG.MASTER_SHEET_NAME) || ss.getSheets()[0];
  
  Logger.log("Starting sync...");
  
  // 1. Sync Website leads
  syncWebsiteLeads(masterSheet);
  
  // 2. Sync Meta leads
  syncMetaLeads(masterSheet);
  
  Logger.log("Sync finished.");
}

/**
 * Sync Website Leads
 */
function syncWebsiteLeads(masterSheet) {
  try {
    const webSS = SpreadsheetApp.openById(CONFIG.WEBSITE_SPREADSHEET_ID);
    const sourceSheet = webSS.getSheetByName(CONFIG.WEBSITE_SHEET_NAME) || webSS.getSheets()[0];
    const lastRow = sourceSheet.getLastRow();
    if (lastRow < 2) return;

    const props = PropertiesService.getScriptProperties();
    const lastProcessed = parseInt(props.getProperty("LAST_ROW_WEBSITE") || "1");

    if (lastRow <= lastProcessed) {
      Logger.log("No new Website leads.");
      return;
    }

    const range = sourceSheet.getRange(lastProcessed + 1, 1, lastRow - lastProcessed, sourceSheet.getLastColumn());
    const data = range.getValues();

    let count = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const firstName = String(row[WEB_COLS.FIRST_NAME - 1] || "").trim();
      const lastName = String(row[WEB_COLS.LAST_NAME - 1] || "").trim();
      const fullName = (firstName + " " + lastName).trim();
      const phone = sanitizePhone(row[WEB_COLS.CONTACT_NUMBER - 1]);
      const email = String(row[WEB_COLS.EMAIL - 1] || "").trim();

      if (!fullName && !phone) continue;

      // Duplicate Check: Name, Phone, or Email
      if (checkDuplicate(masterSheet, fullName, phone, email)) {
        Logger.log("Skip duplicate Website lead: " + fullName);
        continue;
      }

      // Calculate next S.No
      const nextSNo = getNextSNo(masterSheet);
      const rawDate = row[WEB_COLS.DATE - 1];
      const leadDateStr = rawDate ? Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      const newRow = [];
      newRow[CRM_COLS.S_NO - 1]             = nextSNo;
      newRow[CRM_COLS.NAME - 1]             = fullName;
      newRow[CRM_COLS.CITY - 1]             = String(row[WEB_COLS.CITY - 1] || "").trim();
      newRow[CRM_COLS.STATE - 1]            = String(row[WEB_COLS.STATE - 1] || "").trim();
      newRow[CRM_COLS.OCCUPATION - 1]       = String(row[WEB_COLS.OCCUPATION - 1] || "").trim();
      newRow[CRM_COLS.ASSIGNED_TO - 1]      = "Unassigned";
      newRow[CRM_COLS.FBDM - 1]             = "";
      newRow[CRM_COLS.FM_TYPE - 1]          = String(row[WEB_COLS.FRANCHISE_MODEL - 1] || "").trim();
      newRow[CRM_COLS.CONTACT - 1]          = phone;
      newRow[CRM_COLS.EMAIL - 1]            = email;
      newRow[CRM_COLS.SOURCE - 1]           = "Website";
      newRow[CRM_COLS.LEAD_QUALITY - 1]     = "cold";
      newRow[CRM_COLS.FOLLOW_UP_STATUS - 1] = "#First_Call";
      newRow[CRM_COLS.OBJECTION_TAG - 1]    = "";
      newRow[CRM_COLS.LAST_REMARK - 1]      = String(row[WEB_COLS.COMMENT_MESSAGE - 1] || "").trim();
      newRow[CRM_COLS.LAST_ACTIVITY - 1]    = leadDateStr;

      masterSheet.appendRow(newRow);
      count++;

      // Push to Next.js CRM API
      sendToCRM({
        s_no: nextSNo,
        created_at: leadDateStr,
        name: fullName,
        phone: phone,
        email: email,
        city: newRow[CRM_COLS.CITY - 1],
        state: newRow[CRM_COLS.STATE - 1],
        occupation: newRow[CRM_COLS.OCCUPATION - 1],
        fm_type: newRow[CRM_COLS.FM_TYPE - 1],
        source: "Website",
        lead_quality: "cold",
        follow_up_status: "#First_Call",
        remark: newRow[CRM_COLS.LAST_REMARK - 1]
      });
    }

    props.setProperty("LAST_ROW_WEBSITE", lastRow.toString());
    Logger.log("Synced " + count + " new Website leads.");
  } catch (err) {
    Logger.log("Error syncing Website leads: " + err.toString());
  }
}

/**
 * Sync Meta Leads
 */
function syncMetaLeads(masterSheet) {
  try {
    const metaSS = SpreadsheetApp.openById(CONFIG.META_SPREADSHEET_ID);
    const sourceSheet = metaSS.getSheetByName(CONFIG.META_SHEET_NAME) || metaSS.getSheets()[0];
    const lastRow = sourceSheet.getLastRow();
    if (lastRow < 2) return;

    const props = PropertiesService.getScriptProperties();
    const lastProcessed = parseInt(props.getProperty("LAST_ROW_META") || "1");

    if (lastRow <= lastProcessed) {
      Logger.log("No new Meta leads.");
      return;
    }

    const range = sourceSheet.getRange(lastProcessed + 1, 1, lastRow - lastProcessed, sourceSheet.getLastColumn());
    const data = range.getValues();

    let count = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const fullName = String(row[META_COLS.FULL_NAME - 1] || "").trim();
      const phone = sanitizePhone(row[META_COLS.PHONE - 1]);
      const email = String(row[META_COLS.EMAIL - 1] || "").trim();

      if (!fullName && !phone) continue;

      // Duplicate Check: Name, Phone, or Email
      if (checkDuplicate(masterSheet, fullName, phone, email)) {
        Logger.log("Skip duplicate Meta lead: " + fullName);
        continue;
      }

      // Calculate next S.No
      const nextSNo = getNextSNo(masterSheet);
      const rawDate = row[META_COLS.CREATED_TIME - 1];
      const leadDateStr = rawDate ? Utilities.formatDate(new Date(rawDate), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      const newRow = [];
      newRow[CRM_COLS.S_NO - 1]             = nextSNo;
      newRow[CRM_COLS.NAME - 1]             = fullName;
      newRow[CRM_COLS.CITY - 1]             = String(row[META_COLS.CITY - 1] || "").trim();
      newRow[CRM_COLS.STATE - 1]            = String(row[META_COLS.STATE - 1] || "").trim();
      newRow[CRM_COLS.OCCUPATION - 1]       = String(row[META_COLS.JOB_TITLE - 1] || "").trim();
      newRow[CRM_COLS.ASSIGNED_TO - 1]      = "Unassigned";
      newRow[CRM_COLS.FBDM - 1]             = "";
      newRow[CRM_COLS.FM_TYPE - 1]          = String(row[META_COLS.FRANCHISE_MODEL - 1] || "").trim();
      newRow[CRM_COLS.CONTACT - 1]          = phone;
      newRow[CRM_COLS.EMAIL - 1]            = email;
      newRow[CRM_COLS.SOURCE - 1]           = "Facebook_Ads"; // Maps source
      newRow[CRM_COLS.LEAD_QUALITY - 1]     = "warm";
      newRow[CRM_COLS.FOLLOW_UP_STATUS - 1] = "#First_Call";
      newRow[CRM_COLS.OBJECTION_TAG - 1]    = "";
      newRow[CRM_COLS.LAST_REMARK - 1]      = "Campaign: " + String(row[META_COLS.CAMPAIGN_NAME - 1] || "") + " | Platform: " + String(row[META_COLS.PLATFORM - 1] || "");
      newRow[CRM_COLS.LAST_ACTIVITY - 1]    = leadDateStr;

      masterSheet.appendRow(newRow);
      count++;

      // Push to Next.js CRM API
      sendToCRM({
        s_no: nextSNo,
        created_at: leadDateStr,
        name: fullName,
        phone: phone,
        email: email,
        city: newRow[CRM_COLS.CITY - 1],
        state: newRow[CRM_COLS.STATE - 1],
        occupation: newRow[CRM_COLS.OCCUPATION - 1],
        fm_type: newRow[CRM_COLS.FM_TYPE - 1],
        source: "Facebook_Ads",
        lead_quality: "warm",
        follow_up_status: "#First_Call",
        remark: newRow[CRM_COLS.LAST_REMARK - 1]
      });
    }

    props.setProperty("LAST_ROW_META", lastRow.toString());
    Logger.log("Synced " + count + " new Meta leads.");
  } catch (err) {
    Logger.log("Error syncing Meta leads: " + err.toString());
  }
}

/**
 * Duplicate check logic
 * Checks if Name, Phone, or Email already exists in the Master CRM Sheet
 */
function checkDuplicate(sheet, name, phone, email) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  
  const cleanName = name.toLowerCase().trim();
  const cleanPhone = String(phone || "").trim();
  const cleanEmail = email.toLowerCase().trim();

  for (let i = 0; i < data.length; i++) {
    const dbName = String(data[i][CRM_COLS.NAME - 1] || "").toLowerCase().trim();
    const dbPhone = sanitizePhone(data[i][CRM_COLS.CONTACT - 1]);
    const dbEmail = String(data[i][CRM_COLS.EMAIL - 1] || "").toLowerCase().trim();

    // Check by Name
    if (cleanName && dbName === cleanName) return true;
    // Check by Phone
    if (cleanPhone && dbPhone === cleanPhone) return true;
    // Check by Email
    if (cleanEmail && dbEmail === cleanEmail) return true;
  }
  return false;
}

/**
 * Helper to calculate next S.No
 */
function getNextSNo(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  const lastSNo = parseInt(sheet.getRange(lastRow, CRM_COLS.S_NO).getValue());
  return isNaN(lastSNo) ? lastRow : lastSNo + 1;
}

/**
 * Helper to clean and format phone numbers (removes spaces, +, etc.)
 */
function sanitizePhone(phoneVal) {
  if (!phoneVal) return "";
  let clean = String(phoneVal).replace(/[+\s\-()]/g, "").trim();
  // If it starts with country code 91 and has 12 digits, we can keep it standard
  if (clean.startsWith("91") && clean.length === 12) {
    clean = clean.substring(2);
  }
  return clean;
}

/**
 * Send lead details to CRM
 */
function sendToCRM(payload) {
  try {
    const options = {
      method: "post",
      contentType: "application/json",
      headers: { "x-capture-secret": CONFIG.CAPTURE_SECRET },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    const response = UrlFetchApp.fetch(CONFIG.CRM_ENDPOINT, options);
    const code = response.getResponseCode();
    Logger.log("CRM push status [" + code + "]: " + response.getContentText());
  } catch (e) {
    Logger.log("Error pushing to CRM: " + e.toString());
  }
}

/**
 * Setup background time trigger (Runs every 5 minutes)
 */
function setupSyncTrigger() {
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
  Logger.log("Trigger successfully created!");
}

/**
 * Reset row processing indexes to run a full resync from row 2
 */
function resetSyncPointers() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty("LAST_ROW_WEBSITE");
  props.deleteProperty("LAST_ROW_META");
  Logger.log("Sync pointers reset.");
}

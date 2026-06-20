/**
 * AYKA CRM — Google Apps Script
 * ─────────────────────────────
 * Sheet: META / FACEBOOK ADS LEADS
 *
 * HOW TO USE:
 * 1. Open your Meta/Facebook Leads Google Sheet
 * 2. Click Extensions → Apps Script
 * 3. Paste this entire file, replacing any existing code
 * 4. Click Save, then run "setupTrigger" once manually
 * 5. Grant permissions when prompted
 *
 * Meta Lead Ads typically export columns like:
 * Timestamp, Full Name, Phone, Email, City, State, Ad Name, Form Name
 */

// ─── CONFIG ─────────────────────────────────────────────────────────────────
var CRM_ENDPOINT = "https://aykacare.co.in/api/leads/capture";

var CAPTURE_SECRET = "ayka-crm-secret-2024"; // must match LEADS_CAPTURE_SECRET in .env.local
var SHEET_NAME     = "Sheet1";               // change to your actual sheet tab name
var SOURCE         = "Facebook_Ads";         // shown in CRM as the lead source
var HEADER_ROW     = 1;                      // row number of your column headers

// Column LETTERS in your sheet (edit to match your Meta sheet layout):
var COL = {
  timestamp:  "A",  // Timestamp / Date
  name:       "B",  // Full Name
  phone:      "C",  // Phone Number
  email:      "D",  // Email
  city:       "E",  // City
  state:      "F",  // State / Province
  fm_type:    "G",  // FM Type (CF/MF/DF/SF) — if your form has this field
  message:    "H",  // Any notes/message field
};
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggered automatically on every new row.
 */
function onNewRow(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log("Sheet not found: " + SHEET_NAME);
      return;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow <= HEADER_ROW) return;

    var row = lastRow;

    function getCell(colLetter) {
      var col = colLetter.toUpperCase().charCodeAt(0) - 64;
      return sheet.getRange(row, col).getValue();
    }

    var name = String(getCell(COL.name) || "").trim();
    if (!name) {
      Logger.log("Row " + row + " skipped — no name found.");
      return;
    }

    var payload = {
      created_at:   String(getCell(COL.timestamp) || ""),
      name:         name,
      phone:        String(getCell(COL.phone) || ""),
      email:        String(getCell(COL.email) || ""),
      city:         String(getCell(COL.city) || ""),
      state:        String(getCell(COL.state) || ""),
      fm_type:      String(getCell(COL.fm_type) || ""),
      remark:       String(getCell(COL.message) || ""),
      source:       SOURCE,
      lead_quality: "warm", // Meta leads default to warm (they showed intent)
    };

    sendToCRM(payload, row);
  } catch (err) {
    Logger.log("onNewRow error: " + err.toString());
  }
}

/**
 * Bulk sync — call this manually to import ALL existing rows into CRM.
 * Run once from Apps Script editor: Run → syncAllRows
 */
function syncAllRows() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) { Logger.log("Sheet not found: " + SHEET_NAME); return; }

  var lastRow = sheet.getLastRow();
  var batch   = [];

  for (var row = HEADER_ROW + 1; row <= lastRow; row++) {
    function getCell(colLetter, r) {
      var col = colLetter.toUpperCase().charCodeAt(0) - 64;
      return sheet.getRange(r, col).getValue();
    }
    var name = String(getCell(COL.name, row) || "").trim();
    if (!name) continue;

    batch.push({
      created_at:   String(getCell(COL.timestamp, row) || ""),
      name:         name,
      phone:        String(getCell(COL.phone, row) || ""),
      email:        String(getCell(COL.email, row) || ""),
      city:         String(getCell(COL.city, row) || ""),
      state:        String(getCell(COL.state, row) || ""),
      fm_type:      String(getCell(COL.fm_type, row) || ""),
      remark:       String(getCell(COL.message, row) || ""),
      source:       SOURCE,
      lead_quality: "warm",
    });

    if (batch.length === 50) {
      sendToCRM(batch, "batch");
      batch = [];
      Utilities.sleep(500);
    }
  }

  if (batch.length > 0) sendToCRM(batch, "final-batch");
  Logger.log("Bulk sync complete.");
}

/**
 * POST payload to AYKA CRM endpoint
 */
function sendToCRM(payload, rowRef) {
  var options = {
    method:      "post",
    contentType: "application/json",
    headers:     { "x-capture-secret": CAPTURE_SECRET },
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(CRM_ENDPOINT, options);
  var code     = response.getResponseCode();
  var body     = response.getContentText();

  if (code === 200 || code === 201) {
    Logger.log("✓ Row " + rowRef + " sent to CRM: " + body);
  } else {
    Logger.log("✗ Row " + rowRef + " failed (" + code + "): " + body);
  }
}

/**
 * Run this ONCE to create the automatic trigger.
 */
function setupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onNewRow") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger("onNewRow")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onChange()
    .create();

  Logger.log("Trigger created! onNewRow will fire on every new Meta lead row.");
}

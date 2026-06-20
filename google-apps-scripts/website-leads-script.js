const SHEET_ID = '1YyuiyDst6ldqW7Whhjo0Sf05rsUqK45OTCWF_NQEyuo';
const SHEET_NAME = 'Sheet1'; // Update this if your tab name is different

// Internal team email addresses
const TEAM_EMAILS = [
  'noreplyayka@gmail.com',
  'iaykacare@gmail.com',
  'hello@aykaalliance.in'
];

// ─── AYKA CRM CONFIG ─────────────────────────────────────────────────────────
const CRM_ENDPOINT   = "https://aykacare.co.in/api/leads/capture"; // ✅ Live URL
const CAPTURE_SECRET = "ayka-crm-secret-2024";
// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const payload  = JSON.parse(e.postData.contents);
    const fullName = payload.name || ((payload.firstName || '') + ' ' + (payload.lastName || '')).trim();

    // 1. Append row to Google Sheet
    const row = [
      '',                         // A: S.No
      new Date(),                 // B: Date
      fullName,                   // C: Name
      payload.city       || '',   // D: City
      payload.state      || '',   // E: State
      payload.occupation || '',   // F: Occupation
      'Unassigned',               // G: Assigned To
      '',                         // H: FBDM
      payload.model      || '',   // I: FM Type
      payload.phone      || '',   // J: Contact
      payload.email      || '',   // K: Email
      'Website',                  // L: Source
      'cold',                     // M: Lead Quality
      '#First_Call',              // N: Follow-up Status
      '',                         // O: Objection Tag
      payload.comment    || '',   // P: Last Remark
      new Date()                  // Q: Last Activity
    ];

    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
    sheet.appendRow(row);

    // 2. Send to AYKA CRM immediately (non-blocking)
    try {
      sendRowToCRM({
        created_at:   new Date().toISOString(),
        name:         fullName,
        phone:        payload.phone      || '',
        email:        payload.email      || '',
        city:         payload.city       || '',
        state:        payload.state      || '',
        fm_type:      payload.model      || '',
        occupation:   payload.occupation || '',
        remark:       payload.comment    || '',
        source:       'Website',
        lead_quality: 'cold',
      });
    } catch (crmErr) {
      Logger.log('CRM sync error (non-fatal): ' + crmErr.toString());
    }

    // 3. Send Acknowledgment Email to Customer
    if (payload.email) {
      const customerSubject = "We have received your franchise enquiry - AYKA Care";
      const customerBody = `
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #1B3A2D;">Hello ${payload.firstName || 'Partner'},</h2>
          <p>Thank you for showing interest in partnering with <strong>AYKA Care</strong>. We have received your franchise enquiry details.</p>
          <p>Our team is currently reviewing your request for the <strong>${payload.model || 'Franchise'}</strong> model in <strong>${payload.city || ''}, ${payload.state || ''}</strong>.</p>
          <p>One of our franchise development managers will get in touch with you shortly.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #777;">This is an automated response. Please do not reply directly to this email.</p>
        </body>
        </html>
      `;
      MailApp.sendEmail({ to: payload.email, subject: customerSubject, htmlBody: customerBody });
    }

    // 4. Send Internal Alert Email to Team
    const teamSubject = `New Franchise Enquiry: ${fullName} (${payload.city || ''})`;
    const teamBody = `
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <h2 style="color: #1B3A2D;">New Enquiry Received</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 180px;">Name</td><td style="padding: 8px; border: 1px solid #ddd;">${fullName}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td><td style="padding: 8px; border: 1px solid #ddd;">${payload.email || ''}</td></tr>
          <tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Phone</td><td style="padding: 8px; border: 1px solid #ddd;">${payload.phone || ''}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">City / State</td><td style="padding: 8px; border: 1px solid #ddd;">${payload.city || ''}, ${payload.state || ''}</td></tr>
          <tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Franchise Model</td><td style="padding: 8px; border: 1px solid #ddd;">${payload.model || ''}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Current Occupation</td><td style="padding: 8px; border: 1px solid #ddd;">${payload.occupation || ''}</td></tr>
          <tr style="background: #f9f9f9;"><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Message / Comment</td><td style="padding: 8px; border: 1px solid #ddd;">${payload.comment || ''}</td></tr>
        </table>
      </body>
      </html>
    `;
    MailApp.sendEmail({ to: TEAM_EMAILS.join(','), subject: teamSubject, htmlBody: teamBody });

    return ContentService
           .createTextOutput(JSON.stringify({ success: true }))
           .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
           .createTextOutput(JSON.stringify({ success: false, error: err.message }))
           .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── CRM SYNC FUNCTIONS ───────────────────────────────────────────────────────

function sendRowToCRM(leadObj) {
  var options = {
    method:             'post',
    contentType:        'application/json',
    headers:            { 'x-capture-secret': CAPTURE_SECRET },
    payload:            JSON.stringify(leadObj),
    muteHttpExceptions: true,
  };
  var response = UrlFetchApp.fetch(CRM_ENDPOINT, options);
  var code     = response.getResponseCode();
  var body     = response.getContentText();
  Logger.log('CRM response [' + code + ']: ' + body);
  return code;
}

/**
 * BULK IMPORT — Run this once to import all existing rows (fast batch mode)
 */
function syncAllRows() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  var data  = sheet.getDataRange().getValues(); // Read ALL rows at once (fast!)
  var total = data.length;
  var batch    = [];
  var imported = 0;
  var skipped  = 0;

  Logger.log('Starting bulk sync. Total rows: ' + (total - 1));

  for (var i = 1; i < total; i++) { // i=0 is header row
    var name = String(data[i][2] || '').trim(); // C: Name (index 2)
    if (!name) { skipped++; continue; }

    batch.push({
      s_no:             parseInt(data[i][0]) || null,           // A: S.No
      created_at:       String(data[i][1] || ''),               // B: Date (index 1)
      name:             name,                                    // C: Name
      city:             String(data[i][3]  || ''),              // D: City
      state:            String(data[i][4]  || ''),              // E: State
      occupation:       String(data[i][5]  || ''),              // F: Occupation
      assigned_to:      String(data[i][6]  || ''),              // G: Assigned To
      fbdm:             String(data[i][7]  || ''),              // H: FBDM
      fm_type:          String(data[i][8]  || ''),              // I: FM Type
      phone:            String(data[i][9]  || ''),              // J: Contact
      email:            String(data[i][10] || ''),              // K: Email
      source:           String(data[i][11] || 'Website'),       // L: Source
      lead_quality:     String(data[i][12] || 'cold'),          // M: Quality
      follow_up_status: String(data[i][13] || '#First_Call'),   // N: Status
      objection_tag:    String(data[i][14] || ''),              // O: Objection Tag
      remark:           String(data[i][15] || ''),              // P: Last Remark
    });

    // Send in batches of 200
    if (batch.length === 200) {
      sendRowToCRM(batch);
      imported += batch.length;
      batch = [];
      Logger.log('Synced ' + imported + ' rows so far...');
    }
  }

  // Send remaining rows
  if (batch.length > 0) {
    sendRowToCRM(batch);
    imported += batch.length;
  }

  Logger.log('Bulk sync complete. Imported: ' + imported + ', Skipped: ' + skipped);
}

function triggerAuth() {
  MailApp.sendEmail("noreplyayka@gmail.com", "Auth Test", "Authorizing Mail Service");
}

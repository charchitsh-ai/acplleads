const SHEET_ID = '1YyuiyDst6ldqW7Whhjo0Sf05rsUqK45OTCWF_NQEyuo';
const SHEET_NAME = 'Sheet1'; // Update this if your tab name is different (e.g., 'Leads')

// Internal team email addresses
const TEAM_EMAILS = [
  'noreplyayka@gmail.com',
  'iaykacare@gmail.com',
  'hello@aykaalliance.in'
];

// ─── AYKA CRM CONFIG ─────────────────────────────────────────────────────────
// When going live, replace this ngrok URL with your real domain:
const CRM_ENDPOINT     = "https://droopily-renunciable-lorinda.ngrok-free.dev/api/leads/capture";
const CAPTURE_SECRET   = "ayka-crm-secret-2024";
// ─────────────────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const fullName = payload.name || ((payload.firstName || '') + ' ' + (payload.lastName || '')).trim();

    // 1. Build the row values in the exact order of the new sheet:
    // A=S.No, B=Date, C=Name, D=City, E=State, F=Occupation, G=Assigned To, H=FBDM, I=FM Type, J=Contact, K=Email, L=Source, M=Lead Quality, N=Follow-up Status, O=Objection Tag, P=Last Remark, Q=Last Activity
    const row = [
      '',                         // A: S.No (auto-generated or empty)
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

    // Append the row to Google Sheet
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    sheet.appendRow(row);

    // 2. Send to AYKA CRM (non-blocking)
    try {
      sendRowToCRM({
        name:             fullName,
        phone:            payload.phone      || '',
        email:            payload.email      || '',
        city:             payload.city       || '',
        state:            payload.state      || '',
        fm_type:          payload.model      || '',   // CF / MF / DF / SF
        occupation:       payload.occupation || '',
        remark:           payload.comment    || '',
        source:           'Website',
        lead_quality:     'cold',
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
      MailApp.sendEmail({
        to: payload.email,
        subject: customerSubject,
        htmlBody: customerBody
      });
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
    MailApp.sendEmail({
      to: TEAM_EMAILS.join(','),
      subject: teamSubject,
      htmlBody: teamBody
    });

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

/**
 * Send a single lead object or array of leads to AYKA CRM
 */
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
 * BULK IMPORT — Run this to import all existing rows from the second sheet.
 */
function syncAllRows() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var last  = sheet.getLastRow();
  var batch = [];
  var imported = 0;
  var skipped  = 0;

  Logger.log('Starting bulk sync from new sheet. Total rows to process: ' + (last - 1));

  for (var row = 2; row <= last; row++) {   // row 1 = headers
    var name = String(sheet.getRange(row, 3).getValue() || '').trim(); // C: Name
    if (!name) { skipped++; continue; }

    batch.push({
      s_no:             parseInt(sheet.getRange(row, 1).getValue()) || null, // A: S.No
      name:             name,                                            // C: Name
      city:             String(sheet.getRange(row, 4).getValue()  || ''), // D: City
      state:            String(sheet.getRange(row, 5).getValue()  || ''), // E: State
      occupation:       String(sheet.getRange(row, 6).getValue()  || ''), // F: Occupation
      assigned_to:      String(sheet.getRange(row, 7).getValue()  || ''), // G: Assigned To
      fbdm:             String(sheet.getRange(row, 8).getValue()  || ''), // H: FBDM
      fm_type:          String(sheet.getRange(row, 9).getValue()  || ''), // I: FM Type
      phone:            String(sheet.getRange(row, 10).getValue() || ''), // J: Contact
      email:            String(sheet.getRange(row, 11).getValue() || ''), // K: Email
      source:           String(sheet.getRange(row, 12).getValue() || 'Website'), // L: Source
      lead_quality:     String(sheet.getRange(row, 13).getValue() || 'cold'),    // M: Quality
      follow_up_status: String(sheet.getRange(row, 14).getValue() || '#First_Call'), // N: Status
      objection_tag:    String(sheet.getRange(row, 15).getValue() || ''), // O: Objection Tag
      remark:           String(sheet.getRange(row, 16).getValue() || ''), // P: Last Remark
    });

    // Send in batches of 150 (Faster, prevents execution timeout)
    if (batch.length === 150) {
      sendRowToCRM(batch);
      imported += batch.length;
      batch = [];
      Utilities.sleep(100);
      Logger.log('Synced ' + imported + ' rows so far...');
    }
  }

  // Send remaining
  if (batch.length > 0) {
    sendRowToCRM(batch);
    imported += batch.length;
  }

  Logger.log('Bulk sync complete. Imported: ' + imported + ', Skipped: ' + skipped);
}

function triggerAuth() {
  MailApp.sendEmail("noreplyayka@gmail.com", "Auth Test", "Authorizing Mail Service");
}

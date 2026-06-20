import { NextResponse } from 'next/server';

export async function GET() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64 || '';

  // Safety: only show non-sensitive diagnostic info
  const length = raw.length;
  const first80 = raw.substring(0, 80);
  const last30 = raw.substring(Math.max(0, raw.length - 30));
  
  const hasEmail = raw.includes('client_email');
  const hasPrivateKey = raw.includes('private_key');
  const hasBeginKey = raw.includes('BEGIN PRIVATE KEY');
  const startsWithBrace = raw.trimStart().startsWith('{');
  const startsWithQuote = raw.trimStart().startsWith('"');
  const hasEscapedN = raw.includes('\\n');
  const hasRealNewlines = raw.includes('\n');

  let parseResult = 'not attempted';
  if (raw) {
    try {
      JSON.parse(raw);
      parseResult = 'JSON.parse SUCCESS';
    } catch (e: unknown) {
      parseResult = `JSON.parse FAILED: ${e instanceof Error ? e.message.substring(0, 100) : String(e)}`;
    }
  } else {
    parseResult = 'empty';
  }

  // Base64 diagnostics
  const b64Length = b64.length;
  let b64ParseResult = 'empty';
  let b64DecodedLength = 0;
  let b64HasEmail = false;
  let b64HasPrivateKey = false;

  if (b64) {
    try {
      const decoded = Buffer.from(b64.trim(), 'base64').toString('utf8');
      b64DecodedLength = decoded.length;
      b64HasEmail = decoded.includes('client_email');
      b64HasPrivateKey = decoded.includes('private_key');
      JSON.parse(decoded);
      b64ParseResult = 'JSON.parse SUCCESS';
    } catch (e: unknown) {
      b64ParseResult = `JSON.parse FAILED: ${e instanceof Error ? e.message.substring(0, 100) : String(e)}`;
    }
  }

  return NextResponse.json({
    google_service_account_json: {
      length,
      first80,
      last30,
      hasEmail,
      hasPrivateKey,
      hasBeginKey,
      startsWithBrace,
      startsWithQuote,
      hasEscapedN,
      hasRealNewlines,
      parseResult,
    },
    google_service_account_b64: {
      length: b64Length,
      decodedLength: b64DecodedLength,
      hasEmail: b64HasEmail,
      hasPrivateKey: b64HasPrivateKey,
      parseResult: b64ParseResult,
    }
  });
}


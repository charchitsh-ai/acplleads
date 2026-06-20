import { NextResponse } from 'next/server';

export async function GET() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';

  // Safety: only show non-sensitive diagnostic info
  const length = raw.length;
  const first80 = raw.substring(0, 80);
  const last30 = raw.substring(raw.length - 30);
  
  const hasEmail = raw.includes('client_email');
  const hasPrivateKey = raw.includes('private_key');
  const hasBeginKey = raw.includes('BEGIN PRIVATE KEY');
  const startsWithBrace = raw.trimStart().startsWith('{');
  const startsWithQuote = raw.trimStart().startsWith('"');
  const hasEscapedN = raw.includes('\\n');
  const hasRealNewlines = raw.includes('\n');

  let parseResult = 'not attempted';
  try {
    JSON.parse(raw);
    parseResult = 'JSON.parse SUCCESS';
  } catch (e: unknown) {
    parseResult = `JSON.parse FAILED: ${e instanceof Error ? e.message.substring(0, 100) : String(e)}`;
  }

  return NextResponse.json({
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
  });
}

import { NextResponse } from 'next/server';

export async function GET() {
  const raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const b64 = (process.env.GOOGLE_SERVICE_ACCOUNT_B64 || '').trim();

  // Helper to diagnose a string candidate
  const analyzeCandidate = (candidate: string, sourceName: string) => {
    if (!candidate) return { status: 'empty' };

    const length = candidate.length;
    const first80 = candidate.substring(0, 80);
    const last30 = candidate.substring(Math.max(0, candidate.length - 30));
    const startsWithBrace = candidate.startsWith('{');

    let parseDirectStatus = 'not attempted';
    let isDirectJsonSuccess = false;
    if (startsWithBrace) {
      try {
        JSON.parse(candidate);
        parseDirectStatus = 'SUCCESS';
        isDirectJsonSuccess = true;
      } catch (e: unknown) {
        parseDirectStatus = `FAILED: ${e instanceof Error ? e.message.substring(0, 80) : String(e)}`;
      }
    }

    let isBase64Decodable = false;
    let base64DecodedLength = 0;
    let base64ParseStatus = 'not attempted';
    let decodedJsonHasFields = false;

    if (!startsWithBrace) {
      try {
        const decoded = Buffer.from(candidate, 'base64').toString('utf8');
        base64DecodedLength = decoded.length;
        if (decoded.trim().startsWith('{')) {
          isBase64Decodable = true;
          try {
            const parsed = JSON.parse(decoded);
            base64ParseStatus = 'SUCCESS';
            decodedJsonHasFields = !!(parsed.client_email && parsed.private_key);
          } catch (e: unknown) {
            base64ParseStatus = `FAILED: ${e instanceof Error ? e.message.substring(0, 80) : String(e)}`;
          }
        }
      } catch (e) {
        // Not decodable
      }
    }

    return {
      status: 'present',
      length,
      first80,
      last30,
      startsWithBrace,
      isDirectJsonSuccess,
      parseDirectStatus,
      isBase64Decodable,
      base64DecodedLength,
      base64ParseStatus,
      decodedJsonHasFields,
    };
  };

  const rawAnalysis = analyzeCandidate(raw, 'GOOGLE_SERVICE_ACCOUNT_JSON');
  const b64Analysis = analyzeCandidate(b64, 'GOOGLE_SERVICE_ACCOUNT_B64');

  // Run the actual resolution logic
  let resolutionResult = 'NO_CREDENTIALS';
  let effectiveEmail = null;
  let effectiveKeyLength = 0;

  try {
    const candidate = b64 || raw;
    if (candidate) {
      let parsed = null;
      if (candidate.startsWith('{')) {
        parsed = JSON.parse(candidate);
        resolutionResult = 'PARSED_DIRECT_JSON';
      } else {
        const decoded = Buffer.from(candidate, 'base64').toString('utf8');
        parsed = JSON.parse(decoded);
        resolutionResult = 'DECODED_AND_PARSED_BASE64';
      }
      effectiveEmail = parsed.client_email || null;
      effectiveKeyLength = parsed.private_key ? parsed.private_key.length : 0;
    }
  } catch (e: unknown) {
    resolutionResult = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
  }

  return NextResponse.json({
    diagnostics: {
      GOOGLE_SERVICE_ACCOUNT_JSON: rawAnalysis,
      GOOGLE_SERVICE_ACCOUNT_B64: b64Analysis,
    },
    effective_resolution: {
      result: resolutionResult,
      email: effectiveEmail,
      private_key_length: effectiveKeyLength,
      success: !!(effectiveEmail && effectiveKeyLength > 0),
    }
  });
}



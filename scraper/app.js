/**
 * Buna Engine TeleBirr Scraper
 * Zero external dependencies - uses only Node.js built-ins
 * No npm install required!
 */

const http  = require('http');
const https = require('https');
const url   = require('url');

const PORT           = process.env.PORT || 3000;
const BUNA_ENGINE_KEY = process.env.BUNA_ENGINE_KEY || '9f7a2d8e4c6b1a0f9e8d7c6b5a43210fe9';

// ── HTTPS fetch using built-in module ─────────────────────────────────────────
function fetchUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      rejectUnauthorized: false,
    };

    const req = https.get(targetUrl, options, (res) => {
      // Follow redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', reject);
  });
}

// ── Parse Ethio Telecom receipt HTML ──────────────────────────────────────────
function parseReceipt(html, txnId) {
  const data = {
    transactionId: txnId,
    amount:        '',
    senderName:    '',
    receiverName:  '',
    receiverPhone: '',
    dateTime:      '',
    status:        'Success',
  };

  // Strategy 1: receipttableTd class pattern (main table)
  const mainRow = html.match(
    /class="receipttableTd receipttableTd2">\s*([A-Z0-9]{6,20})\s*<\/td>\s*<td class="receipttableTd">\s*([^<]+)<\/td>\s*<td class="receipttableTd">\s*([^<]+)<\/td>/i
  );
  if (mainRow) {
    data.transactionId = mainRow[1].trim();
    data.dateTime      = mainRow[2].trim();
    const rawAmt       = mainRow[3].trim();
    const numMatch     = rawAmt.match(/([\d,]+\.?\d*)/);
    if (numMatch) data.amount = numMatch[1].replace(/,/g, '');
  }

  // Strategy 2: Label → Value rows
  const payerMatch    = html.match(/Payer Name\s*<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>/is);
  const receiverMatch = html.match(/Credited Party name\s*<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>/is);
  const phoneMatch    = html.match(/Credited party account no\s*<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>/is);
  const totalMatch    = html.match(/Total Paid Amount\s*.*?<\/td>\s*<td[^>]*>\s*(.*?)\s*<\/td>/is);

  if (payerMatch)    data.senderName   = payerMatch[1].replace(/<[^>]+>/g, '').trim();
  if (receiverMatch) data.receiverName = receiverMatch[1].replace(/<[^>]+>/g, '').trim();
  if (phoneMatch)    data.receiverPhone= phoneMatch[1].replace(/<[^>]+>/g, '').trim();
  if (totalMatch && !data.amount) {
    const rawAmt = totalMatch[1].replace(/<[^>]+>/g, '').trim();
    const numMatch = rawAmt.match(/([\d,]+\.?\d*)/);
    if (numMatch) data.amount = numMatch[1].replace(/,/g, '');
  }

  // Strategy 3: Raw ETB/Birr fallback
  if (!data.amount) {
    const etbMatch = html.match(/(?:ETB|Birr)\s*([\d,]+\.?\d{0,2})/i)
                  || html.match(/([\d,]+\.?\d{0,2})\s*(?:Birr|ETB)/i);
    if (etbMatch) data.amount = etbMatch[1].replace(/,/g, '');
  }

  // Strategy 4: page contains txnId at all (verification fallback)
  const pageContainsTxn  = html.includes(txnId);
  const successSignals   = ['Payment Successful','Completed','APPROVED','SUCCESS','ተከፍሏል'];
  const hasSuccessSignal = successSignals.some(s => html.includes(s));

  if (!data.amount && !pageContainsTxn && !hasSuccessSignal) {
    return null; // truly not found
  }

  return data;
}

// ── Send JSON response ─────────────────────────────────────────────────────────
function sendJson(res, statusCode, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(statusCode, {
    'Content-Type':  'application/json',
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'x-api-key, Content-Type',
  });
  res.end(body);
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'x-api-key, Content-Type',
    });
    return res.end();
  }

  const parsed  = url.parse(req.url, true);
  const pathname = parsed.pathname || '/';
  const query    = parsed.query;

  // ── Auth ────────────────────────────────────────────────────────────────────
  const apiKey = req.headers['x-api-key'] || '';
  if (BUNA_ENGINE_KEY && apiKey !== BUNA_ENGINE_KEY) {
    return sendJson(res, 401, { success: false, error: 'Unauthorized' });
  }

  // ── Health check: GET / ─────────────────────────────────────────────────────
  if (pathname === '/' && !query.txnId && !query.transactionId) {
    return sendJson(res, 200, {
      success: true,
      status:  'ok',
      message: 'Buna Engine Scraper is Live 🚀',
    });
  }

  // ── Extract txnId ───────────────────────────────────────────────────────────
  let txnId = '';

  // /validate/:txnId
  const pathMatch = pathname.match(/\/validate\/([A-Z0-9]{6,20})/i);
  if (pathMatch) txnId = pathMatch[1].toUpperCase();

  // ?txnId= or ?transactionId=
  if (!txnId) txnId = ((query.txnId || query.transactionId) + '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!txnId || txnId.length < 6) {
    return sendJson(res, 400, { success: false, error: 'Missing or invalid txnId' });
  }

  // ── Scrape ──────────────────────────────────────────────────────────────────
  console.log(`[Scraper] Validating: ${txnId}`);
  const receiptUrl = `https://transactioninfo.ethiotelecom.et/receipt/${txnId}`;

  try {
    const { statusCode, body } = await fetchUrl(receiptUrl);

    if (statusCode === 404) {
      return sendJson(res, 200, { success: false, valid: false, txnId, error: 'Receipt not found (404)' });
    }

    const result = parseReceipt(body, txnId);

    if (!result) {
      console.warn(`[Scraper] ❌ Not found: ${txnId}`);
      return sendJson(res, 200, { success: false, valid: false, txnId, error: 'Receipt not found or could not be parsed' });
    }

    console.log(`[Scraper] ✅ ${txnId} amount=${result.amount}`);
    return sendJson(res, 200, {
      success:       true,
      valid:         true,
      status:        'success',
      txnId:         result.transactionId,
      transactionId: result.transactionId,
      data:          result,
    });

  } catch (err) {
    console.error(`[Scraper] Error: ${err.message}`);
    return sendJson(res, 200, { success: false, valid: false, txnId, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`[Scraper] Buna Engine running on port ${PORT}`);
});

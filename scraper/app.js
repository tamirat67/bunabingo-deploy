const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── API Key Auth ─────────────────────────────────────────────────────────────
const BUNA_ENGINE_KEY = process.env.BUNA_ENGINE_KEY || '9f7a2d8e4c6b1a0f9e8d7c6b5a43210fe9';

const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (BUNA_ENGINE_KEY && apiKey !== BUNA_ENGINE_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

// ── Scraper ──────────────────────────────────────────────────────────────────
async function scrapeTelebirrReceipt(transactionId) {
  const txnId = transactionId.toUpperCase().trim();
  const url = `https://transactioninfo.ethiotelecom.et/receipt/${txnId}`;

  let html;
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });
    html = response.data;
  } catch (err) {
    console.error(`[Scraper] Fetch failed for ${txnId}:`, err.message);
    return null;
  }

  if (!html) return null;

  const $ = cheerio.load(html);

  const data = {
    transactionId: txnId,
    amount: '',
    senderName: '',
    receiverName: '',
    receiverPhone: '',
    dateTime: '',
    status: 'Success',
  };

  // ── Strategy 1: official receipt table classes ──────────────────────────
  // The Ethio Telecom page uses: class="receipttableTd receipttableTd2" for TxnID col
  // and class="receipttableTd" for Date and Amount cols on the same row
  $('tr').each((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length) return;

    const firstCell = $(cells[0]).text().trim();

    // Row with TxnId / Date / Amount  (3-cell layout)
    if (cells.length >= 3) {
      const maybeId = $(cells[0]).text().trim();
      if (/^[A-Z0-9]{6,20}$/.test(maybeId)) {
        data.transactionId = maybeId;
        data.dateTime      = $(cells[1]).text().trim();
        const rawAmt       = $(cells[2]).text().trim();
        const numMatch     = rawAmt.match(/[\d,]+\.?\d*/);
        if (numMatch) data.amount = numMatch[0].replace(/,/g, '');
      }
    }

    // Label: Value rows
    if (cells.length === 2) {
      const label = $(cells[0]).text().trim().toLowerCase();
      const value = $(cells[1]).text().trim();
      if (/payer.?name|sender|from/i.test(label))            data.senderName   = value;
      if (/credited.?party.?name|receiver|to|recipient/i.test(label)) data.receiverName = value;
      if (/credited.?party.?account|receiver.?phone|phone/i.test(label)) data.receiverPhone = value;
      if (/total.?paid|amount|settled/i.test(label)) {
        const numMatch = value.match(/[\d,]+\.?\d*/);
        if (numMatch) data.amount = numMatch[0].replace(/,/g, '');
      }
      if (/date|time/i.test(label) && !data.dateTime) data.dateTime = value;
    }
  });

  // ── Strategy 2: key–value divs (some pages use divs) ────────────────────
  if (!data.senderName) {
    $('div, p, span').each((_, el) => {
      const text = $(el).text().trim();
      const m = text.match(/Payer Name[:\s]+(.+)/i);
      if (m) data.senderName = m[1].trim();
    });
  }

  // ── Strategy 3: raw text ETB/Birr fallback ───────────────────────────────
  if (!data.amount) {
    const fullText = $.text();
    const amtMatch = fullText.match(/([\d,]+\.?\d*)\s*(?:Birr|ETB|ብር)/i)
                  || fullText.match(/(?:Birr|ETB|ብር)\s*([\d,]+\.?\d*)/i);
    if (amtMatch) data.amount = amtMatch[1].replace(/,/g, '');
  }

  // ── Strategy 4: check page contains txnId at all ─────────────────────────
  const pageContainsTxn = html.includes(txnId);
  const successSignals = ['Payment Successful', 'Transaction Successful', 'Completed', 'APPROVED', 'SUCCESS', 'ተከፍሏል'];
  const hasSuccessSignal = successSignals.some(s => html.includes(s));

  // If we can't parse amount but the page clearly has the txnId, still report found
  if (!data.amount && !pageContainsTxn && !hasSuccessSignal) {
    console.warn(`[Scraper] Could not parse receipt for ${txnId}`);
    return null;
  }

  console.log(`[Scraper] ✅ ${txnId} — amount=${data.amount} sender=${data.senderName} receiver=${data.receiverName}`);
  return data;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/', (req, res) => {
  res.json({ success: true, status: 'ok', message: 'Buna Engine Scraper is Live 🚀' });
});

// Path-based: GET /validate/:transactionId
app.get('/validate/:transactionId', authenticate, async (req, res) => {
  const { transactionId } = req.params;
  console.log(`[Scraper] Validating: ${transactionId}`);

  const result = await scrapeTelebirrReceipt(transactionId);

  if (!result) {
    return res.status(200).json({
      success: false,
      valid: false,
      txnId: transactionId.toUpperCase(),
      error: 'Receipt not found or could not be parsed',
    });
  }

  res.json({
    success: true,
    valid: true,
    status: 'success',
    txnId: result.transactionId,
    transactionId: result.transactionId,
    data: result,
  });
});

// Query-based: GET /?txnId=... (called by bunafrankValidator.ts as fallback)
app.get('/', authenticate, async (req, res) => {
  const txnId = req.query.txnId || req.query.transactionId;
  if (!txnId) {
    return res.json({ success: true, status: 'ok', message: 'Buna Engine Scraper is Live 🚀' });
  }

  console.log(`[Scraper] Query validate: ${txnId}`);
  const result = await scrapeTelebirrReceipt(txnId);

  if (!result) {
    return res.status(200).json({
      success: false,
      valid: false,
      txnId: txnId.toString().toUpperCase(),
      error: 'Receipt not found or could not be parsed',
    });
  }

  res.json({
    success: true,
    valid: true,
    status: 'success',
    txnId: result.transactionId,
    transactionId: result.transactionId,
    data: result,
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Scraper] Buna Engine running on port ${PORT}`);
});

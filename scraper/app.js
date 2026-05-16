const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const dotenv = require('dotenv');
const { createWorker } = require('tesseract.js');

dotenv.config();

const app = express();
// Plesk provides the PORT environment variable automatically
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Security: Check for API Key
const BUNA_ENGINE_KEY = process.env.BUNA_ENGINE_KEY;

const authenticate = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (BUNA_ENGINE_KEY && apiKey !== BUNA_ENGINE_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

// --- Telebirr Scraper Logic ---
async function scrapeTelebirrReceipt(transactionId) {
  const url = `https://transactioninfo.ethiotelecom.et/receipt/${transactionId}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const data = {
      transactionId,
      amount: '',
      senderName: '',
      receiverName: '',
      receiverPhone: '',
      dateTime: '',
      status: 'Success'
    };

    // Deep scraping logic for Telebirr table
    $('table tr, div.row, div.detail-item, td, th').each((_, el) => {
      const text = $(el).text().trim();
      
      // Invoice No / Transaction ID
      if (/(Transaction ID|Invoice No|የክፍያ ቁጥር)/i.test(text)) {
        const val = text.split(/[:\/-]/).pop()?.trim();
        if (val && val.length > 5) data.transactionId = val;
      }
      
      // Amount
      if (/(Amount|Settled Amount|የተከፈለው መጠን|ጠቅላላ)/i.test(text)) {
        const val = text.split(/[:\/-]/).pop()?.trim();
        if (val) data.amount = val;
      }

      // Receiver
      if (/(Receiver Name|ወደ|ተቀባይ)/i.test(text)) {
        const val = text.split(/[:\/-]/).pop()?.trim();
        if (val) data.receiverName = val;
      }

      // Date
      if (/(Date|ቀን)/i.test(text)) {
        const val = text.split(/[:\/-]/).pop()?.trim();
        if (val) data.dateTime = val;
      }
    });

    // Fallback: If amount is still empty, look for any ETB/Birr patterns in the text
    if (!data.amount) {
        const fullText = $.text();
        const amountMatch = fullText.match(/([\d,]+\.?\d*)\s*(?:Birr|ETB|ብር)/i);
        if (amountMatch) data.amount = amountMatch[1];
    }

    if (data.amount) {
      const match = data.amount.match(/[\d.]+/);
      if (match) data.amount = match[0];
    }

    return data;
  } catch (error) {
    console.error(`Scrape Error [${transactionId}]:`, error.message);
    return null;
  }
}

// --- API Routes ---
app.get('/validate/:transactionId', authenticate, async (req, res) => {
  const { transactionId } = req.params;
  const result = await scrapeTelebirrReceipt(transactionId);
  
  if (!result) {
    return res.status(404).json({ success: false, error: 'Receipt not found' });
  }
  res.json({ success: true, data: result });
});

app.post('/validate-image', authenticate, async (req, res) => {
  const { imageUrl } = req.body;
  if (!imageUrl) return res.status(400).json({ success: false, error: 'No image URL' });

  try {
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(imageUrl);
    await worker.terminate();

    const txnMatch = text.match(/[A-Z0-9]{8,12}/);
    const amountMatch = text.match(/ETB\s*([\d.]+)/i);

    res.json({
      success: true,
      extracted: {
        transactionId: txnMatch ? txnMatch[0] : null,
        amount: amountMatch ? amountMatch[1] : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'OCR processing failed' });
  }
});

app.get('/', (req, res) => res.send('Telebirr Scraper Active'));

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

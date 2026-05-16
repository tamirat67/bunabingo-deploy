import express, { Request, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// Security: Check for API Key
const BUNA_ENGINE_KEY = process.env.BUNA_ENGINE_KEY;

const authenticate = (req: Request, res: Response, next: any) => {
  const apiKey = req.headers['x-api-key'];
  if (BUNA_ENGINE_KEY && apiKey !== BUNA_ENGINE_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

app.use(authenticate);

interface ReceiptData {
  transactionId: string;
  amount: string;
  senderName: string;
  receiverName: string;
  receiverPhone: string;
  dateTime: string;
  status: string;
}

/**
 * Scrapes the Telebirr receipt page for a given transaction ID
 */
async function scrapeTelebirrReceipt(transactionId: string): Promise<ReceiptData | null> {
  const url = `https://transactioninfo.ethiotelecom.et/receipt/${transactionId}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Telebirr receipt pages usually have a table or a set of divs with data.
    // Based on common formats, we look for labels and their next sibling values.
    // Note: The actual selectors might need adjustment based on the live page structure.
    
    const data: any = {
      transactionId,
      amount: '',
      senderName: '',
      receiverName: '',
      receiverPhone: '',
      dateTime: '',
      status: 'Success'
    };

    // Scrappy generic parsing: look for common labels
    $('div, td, span').each((_, el) => {
      const text = $(el).text().trim();
      const nextText = $(el).next().text().trim() || $(el).parent().find('dd').text().trim();

      if (/Transaction ID/i.test(text)) data.transactionId = nextText || text.split(':').pop()?.trim();
      if (/Amount/i.test(text)) data.amount = nextText || text.split(':').pop()?.trim();
      if (/Sender/i.test(text)) data.senderName = nextText || text.split(':').pop()?.trim();
      if (/Receiver Name|Receiver/i.test(text)) data.receiverName = nextText || text.split(':').pop()?.trim();
      if (/Receiver Phone|Phone/i.test(text)) data.receiverPhone = nextText || text.split(':').pop()?.trim();
      if (/Date|Time/i.test(text)) data.dateTime = nextText || text.split(':').pop()?.trim();
    });

    // If generic parsing failed, try specific selectors if known
    // Example: $('.receipt-value').each(...)
    
    // Cleanup amount (extract only numbers and decimal)
    if (data.amount) {
      const amountMatch = data.amount.match(/[\d.]+/);
      if (amountMatch) data.amount = amountMatch[0];
    }

    return data;
  } catch (error: any) {
    console.error(`Error scraping transaction ${transactionId}:`, error.message);
    return null;
  }
}

// API Routes
app.get('/validate/:transactionId', async (req: Request, res: Response) => {
  const { transactionId } = req.params;
  
  if (!transactionId || transactionId.length < 5) {
    return res.status(400).json({ success: false, error: 'Invalid Transaction ID' });
  }

  console.log(`Validating transaction: ${transactionId}`);
  
  const receiptData = await scrapeTelebirrReceipt(transactionId);
  
  if (!receiptData) {
    return res.status(404).json({ success: false, error: 'Receipt not found or could not be scraped' });
  }

  res.json({
    success: true,
    data: receiptData
  });
});

// OCR Route for Image Validation
app.post('/validate-image', async (req: Request, res: Response) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ success: false, error: 'No Image URL provided' });
  }

  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(imageUrl);
    await worker.terminate();

    console.log('OCR Result:', text);

    // Try to extract Transaction ID (DE... or similar)
    const txnMatch = text.match(/[A-Z0-9]{8,12}/);
    const amountMatch = text.match(/ETB\s*([\d.]+)/i);

    res.json({
      success: true,
      rawText: text,
      extracted: {
        transactionId: txnMatch ? txnMatch[0] : null,
        amount: amountMatch ? amountMatch[1] : null
      }
    });
  } catch (error: any) {
    console.error('OCR Error:', error.message);
    res.status(500).json({ success: false, error: 'OCR failed' });
  }
});

// Health check
app.get('/', (req, res) => {
  res.send('Telebirr Scraper API is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

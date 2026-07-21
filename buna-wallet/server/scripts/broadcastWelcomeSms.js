require('dotenv').config({ path: '../.env' });
const fetch = require('node-fetch');
const db = require('../db');

// Add your Expo EAS APK link here once the build completes!
const APK_LINK = 'https://bunatechhub.net/buna-wallet.apk'; 

const WELCOME_MESSAGE = `🎉 እንኳን ወደ ቡና ዋሌት (Buna Wallet) በደህና መጡ!
መገለጫዎን እና የይለፍ ቃልዎን ለማዘመን መተግበሪያውን ያውርዱ።
📥 ${APK_LINK}

እርዳታ: +251997688294
Telegram: @buna_bingobot (https://t.me/buna_bingobot1)

እናመሰግናለን!`;

async function sendSMSViaTelerivet(phone, message) {
  const apiKey = process.env.TELERIVET_API_KEY;
  const projectId = process.env.TELERIVET_PROJECT_ID;
  const phoneId = process.env.TELERIVET_PHONE_ID;

  if (!apiKey || !projectId || !phoneId) {
    throw new Error('Telerivet credentials not configured. Check your .env file.');
  }

  const url = `https://api.telerivet.com/v1/projects/${projectId}/messages/send`;
  const credentials = Buffer.from(`${apiKey}:`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to_number: phone,
      content: message,
      route_id: phoneId,
      message_type: 'sms',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || `SMS send failed (${response.status})`);
  }
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function broadcastSMS() {
  console.log('🚀 Starting SMS Broadcast...');
  console.log('Message:', WELCOME_MESSAGE);

  try {
    // 1. Fetch all unique users with valid phone numbers
    const res = await db.query(`
      SELECT DISTINCT phone 
      FROM users 
      WHERE phone IS NOT NULL AND phone != ''
    `);
    
    const users = res.rows;
    console.log(`Found ${users.length} users in the database.`);

    if (users.length === 0) {
      console.log('No users to send SMS to.');
      process.exit(0);
    }

    let successCount = 0;
    let failCount = 0;

    // 2. Loop through users and send SMS with a delay to avoid rate limiting
    for (let i = 0; i < users.length; i++) {
      const phone = users[i].phone;
      console.log(`[${i + 1}/${users.length}] Sending to ${phone}...`);
      
      try {
        await sendSMSViaTelerivet(phone, WELCOME_MESSAGE);
        console.log(`✅ Success: ${phone}`);
        successCount++;
      } catch (err) {
        console.error(`❌ Failed: ${phone} - ${err.message}`);
        failCount++;
      }

      // WAIT 10 SECONDS BETWEEN SMS
      // (Telerivet & EthioTelecom have strict rate limits for mass SMS on standard Android phones)
      await sleep(10000); 
    }

    console.log('🎉 Broadcast Complete!');
    console.log(`Total Sent: ${successCount}`);
    console.log(`Total Failed: ${failCount}`);

  } catch (err) {
    console.error('Database or Setup Error:', err);
  } finally {
    db.pool.end();
  }
}

broadcastSMS();

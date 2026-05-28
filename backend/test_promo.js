const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
  try {
    const formData = new FormData();
    formData.append('title', 'Test');
    formData.append('message', 'Test message');
    formData.append('type', 'announcement');
    formData.append('scheduledAt', '');
    formData.append('expiresAt', '');
    
    // Add auth if needed (how does the frontend authenticate?)
    // In api.ts, restrictToAdmin checks req.headers.authorization
    // Let's assume there is a token. Wait, restrictToAdmin uses cookie or auth header?
    // Actually, I can just read the restrictToAdmin middleware.
    
    const res = await axios.post('http://localhost:3001/api/admin/promotions', formData, {
      headers: {
        ...formData.getHeaders(),
        // need auth token...
      }
    });
    console.log(res.data);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
  }
}
test();

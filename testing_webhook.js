//This file is to test the web hook when you make changes to database and it has to populated to Google Sheets.
//This web hook will call the endpoint '/db-webhook' which will update the Google Sheets.

const axios = require('axios');

async function testWebhook() {
  try {
    const response = await axios.post('http://localhost:3000/db-webhook', {
      action: 'insert',
      id: 5,
      column1: 'Sample Data - 2',
      column2: 'More Data - 2',
    });

    console.log('Response:', response.data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testWebhook();
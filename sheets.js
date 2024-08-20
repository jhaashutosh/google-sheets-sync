const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const credentials = require('./credentials.json');
require('dotenv').config()

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const authorize = () => {
  try {
    const client = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: SCOPES,
    });   
    return client;
  } catch(err) {
    console.log('authorization failed!', err);
  }

};

const getSheetData = async (auth) => {
  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Sheet1!A2:B',
  });
  console.log(response.data.values);
  return response.data.values;
};

module.exports = { authorize, getSheetData };
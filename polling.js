//This is the polling approach which I tried initially

const { google } = require('googleapis');
const { authorize, getSheetData } = require('./sheets');
const connection = require('./db');

let lastDBSync = null;
let lastSheetData = null;

const syncGoogleSheetsToDB = async () => {
  const auth = authorize();
  const sheetData = await getSheetData(auth);

  if (JSON.stringify(sheetData) !== JSON.stringify(lastSheetData)) {
    console.log('Data has changed, updating database...');
    
    sheetData.forEach(row => {
      connection.query(
        'INSERT INTO sheet_data (column1, column2) VALUES (?, ?) ON DUPLICATE KEY UPDATE column2 = ?, last_modified = NOW()',
        [row[0], row[1], row[1]],
        (err, results) => {
          if (err) throw err;
        }
      );
    });

    console.log('Database updated from Google Sheets');
    lastSheetData = sheetData;
  } else {
    console.log('No changes detected in Google Sheets');
  }
};

const syncDBToGoogleSheets = async () => {
  const auth = authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  connection.query('SELECT * FROM sheet_data WHERE last_modified > ?', [lastDBSync], async (err, results) => {
    if (err) throw err;

    if (results.length > 0) {
      console.log('Database changes detected, updating Google Sheets...');

      const updatePromises = results.map((row) => {
        return sheets.spreadsheets.values.update({
          spreadsheetId: '1hvIY6YYN9UOVD9BxO3SlJs5VXPQDn_KB5Q3i7LnKdEo',
          range: `Sheet1!A${row.id}:B${row.id}`,
          valueInputOption: 'RAW',
          resource: {
            values: [[row.column1, row.column2]],
          },
        });
      });

      await Promise.all(updatePromises);
      console.log('Google Sheets updated from database');

      lastDBSync = new Date();
    } else {
      console.log('No changes detected in the database');
    }
  });
};

setInterval(syncGoogleSheetsToDB, 60000);
setInterval(syncDBToGoogleSheets, 60000);
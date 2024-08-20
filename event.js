const express = require('express');
const { google } = require('googleapis');
const {authorize} = require('./sheets');
const { syncCompleteSheet, createTableAndTriggers, pollSyncLog } = require('./utils');
const connection = require('./db');
require('dotenv').config();

// Initialize Express app
const app = express();
app.use(express.json());


// Function to sync table schema with Google Sheets
const syncTableSchema = async (sheetName, sheetColumns) => {
    try {
        const [rows] = await connection.promise().query(`SHOW COLUMNS FROM \`${sheetName}\``);
        const existingColumns = rows.map(row => row.Field);
        
        const columnsToAdd = sheetColumns.filter(col => !existingColumns.includes(col));
        for (const column of columnsToAdd) {
            const addColumnSql = `ALTER TABLE \`${sheetName}\` ADD COLUMN \`${column}\` VARCHAR(255)`;
            await connection.promise().query(addColumnSql);
            console.log(`Column ${column} added to table ${sheetName}`);
        }
    } catch (err) {
        console.error('Error syncing table schema:', err);
    }
};

// Webhook Handler for Google Sheets
app.post('/sheet-webhook', async (req, res) => {
    try {
        const { range, values, sheetName } = req.body;
        console.log("Received webhook from Google Sheets:", range, values, sheetName);

        const rowIndex = range.match(/\d+/)[0];
        const columnLetter = range.match(/[A-Z]+/)[0];
        const columnName = columnLetter;
        const cellValue = values[0][0];

        const sheetColumns = [columnName];

        const [tables] = await connection.promise().query(`SHOW TABLES LIKE ?`, [sheetName]);

        // if (tables.length === 0) {
        //     await createTableAndTriggers(sheetName, sheetColumns);
        // } else {
        //     await syncTableSchema(sheetName, sheetColumns);
        // }

        const [rows] = await connection.promise().query(`SELECT * FROM \`${sheetName}\` WHERE id = ?`, [rowIndex]);

        if (rows.length > 0) {
            const updateSql = `UPDATE \`${sheetName}\` SET \`${columnName}\` = ? WHERE id = ?`;
            await connection.promise().query(updateSql, [cellValue, rowIndex]);
            console.log('Database updated from Google Sheets');
        } else {
            const insertSql = `INSERT INTO \`${sheetName}\` (id, \`${columnName}\`) VALUES (?, ?)`;
            await connection.promise().query(insertSql, [rowIndex, cellValue]);
            console.log('New entry added to the database from Google Sheets');
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error handling sheet webhook:', error);
        res.status(500).send('Internal server error');
    }
});

// Webhook Handler for Database Changes
app.post('/db-webhook', async (req, res) => {
    try {
        const { action_type, row_id, row_data } = req.body;

        console.log("Received webhook from database:", action_type, row_id, row_data);

        const auth = authorize();
        const sheets = google.sheets({ version: 'v4', auth });

        const range = `Sheet1!A${row_id}:Z${row_id}`; // Assuming your data fits within columns A to Z

        if (action_type.toLowerCase() === 'insert' || action_type.toLowerCase() === 'update') {
            const values = Object.keys(row_data).map(key => row_data[key] || '');
            
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.SHEET_ID,
                range: range,
                valueInputOption: 'RAW',
                resource: {
                    values: [values],
                },
            });
            console.log('Google Sheets updated from database');
        } else if (action_type.toLowerCase() === 'delete') {
            await sheets.spreadsheets.values.clear({
                spreadsheetId: process.env.SHEET_ID,
                range: range,
            });
            console.log('Row deleted in Google Sheets');
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error handling database webhook:', error);
        res.status(500).send('Internal server error');
    }
});

const initializeSync = async () => {
    try {
        await syncCompleteSheet(connection);

        setInterval(() => {pollSyncLog(connection, process.env.NGROK_URL)}, 5000);
    } catch (error) {
        console.error('Error initializing sync:', error);
    }
};

initializeSync();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
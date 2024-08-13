//It is work in progress, it will be real time and more optimized

const express = require('express');
const { google } = require('googleapis');
const connection = require('./db');
const { authorize } = require('./sheets');
const axios = require('axios');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

app.post('/sheet-webhook', async (req, res) => {
    try {
        const { range, values } = req.body;
        console.log("Getting values from webhook", range, values);

        const rowIndex = range.match(/\d+/)[0]; // Extracting row number from range (e.g., A6 -> 6)
        const columnLetter = range.match(/[A-Z]+/)[0]; // Extracting column letter (e.g., A6 -> A)

        let columnAValue = null;
        let columnBValue = null;

        if (columnLetter === 'A') {
            columnAValue = values[0][0]; // Assigning value to column1 if it's from column A
        } else if (columnLetter === 'B') {
            columnBValue = values[0][0]; // Assigning value to column2 if it's from column B
        }

        const checkSql = 'SELECT * FROM sheet_data WHERE id = ?';
        connection.query(checkSql, [rowIndex], (err, result) => {
            if (err) {
                console.error('Error checking database:', err);
                return res.status(500).send('Database check failed');
            }

            if (result.length > 0) {
                const updateSql = 'UPDATE sheet_data SET column1 = IFNULL(?, column1), column2 = IFNULL(?, column2) WHERE id = ?';
                connection.query(updateSql, [columnAValue, columnBValue, rowIndex], (err, result) => {
                    if (err) {
                        console.error('Error updating database:', err);
                        return res.status(500).send('Database update failed');
                    }
                    console.log('Database updated from Google Sheets');
                    
                    io.emit('db-update', {
                        action: 'update',
                        id: rowIndex,
                        column1: columnAValue,
                        column2: columnBValue,
                    });

                    res.sendStatus(200);
                });
            } else {
                const insertSql = 'INSERT INTO sheet_data (id, column1, column2) VALUES (?, ?, ?)';
                connection.query(insertSql, [rowIndex, columnAValue, columnBValue], (err, result) => {
                    if (err) {
                        console.error('Error inserting into database:', err);
                        return res.status(500).send('Database insert failed');
                    }
                    console.log('New entry added to the database from Google Sheets');
                    
                    io.emit('db-update', {
                        action: 'insert',
                        id: rowIndex,
                        column1: columnAValue,
                        column2: columnBValue,
                    });

                    res.sendStatus(200);
                });
            }
        });
    } catch (error) {
        console.error('Error handling sheet webhook:', error);
        res.status(500).send('Internal server error');
    }
});

app.post('/db-webhook', async (req, res) => {
    try {
        const { action, id, column1, column2 } = req.body;

        const auth = authorize();
        const sheets = google.sheets({ version: 'v4', auth });

        if (action === 'insert' || action === 'update') {
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.SHEET_ID,
                range: `Sheet1!A${id}:B${id}`,
                valueInputOption: 'RAW',
                resource: {
                    values: [[column1, column2]],
                },
            });
            console.log('Google Sheets updated from database');
        } else if (action === 'delete') {
            await sheets.spreadsheets.values.clear({
                spreadsheetId: process.env.SHEET_ID,
                range: `Sheet1!A${id}:B${id}`,
            });
            console.log('Row deleted in Google Sheets');
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error handling database webhook:', error);
        res.status(500).send('Internal server error');
    }
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});

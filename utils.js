const {authorize} = require('./sheets');
const { google } = require('googleapis');
const axios = require('axios');

const getColumnLetter = (columnNumber) => {
    let columnLetter = '';
    let temp;

    while (columnNumber > 0) {
        temp = (columnNumber - 1) % 26;
        columnLetter = String.fromCharCode(65 + temp) + columnLetter;
        columnNumber = Math.floor((columnNumber - temp) / 26);
    }

    return columnLetter;
};

const checkTableExists = async (sheetName, connection) => {
    const checkTableQuery = `SELECT 1 FROM \`${sheetName}\` LIMIT 1`;
    try {
        await new Promise((resolve, reject) => {
            connection.query(checkTableQuery, (err, results) => {
                if (err) reject(err);
                resolve(results);
            });
        });
        return true;
    } catch (error) {
        return false;
    }
};

const syncCompleteSheet = async (connection, sheet) => {
    try {
        const auth = authorize();
        const sheets = google.sheets({ version: 'v4', auth });

        // Get the sheet data to determine the number of columns
        const sheetMetadata = await sheets.spreadsheets.get({
            spreadsheetId: process.env.SHEET_ID,
        });

        // Assuming data is in the first sheet
        const sheet = sheetMetadata.data.sheets[0];
        const numColumns = sheet.properties.gridProperties.columnCount;

        // Calculate the last column letter
        const lastColumnLetter = getColumnLetter(numColumns);

        // Construct the dynamic range
        const range = `Sheet1!A1:${lastColumnLetter}`;

        // Fetch the data from the sheet using the dynamic range
        const sheetData = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SHEET_ID,
            range: range,
        });

        // Creation of primary and sync_log table

        // Check if the primary table already exists
        const primaryTableExists = await checkTableExists('sheet1', connection);
        if (primaryTableExists) {
            console.log(`Table sheet1 already exists. Skipping table creation and data insertion.`);
        } else {
            console.log(`Table sheet1 does not exist. Creating table...`);
            await createTableFromData(sheetData.data.values, 'sheet1', connection);
        }

        // Check if the sync_log table already exists
        const syncLogTableExists = await checkTableExists(`sync_log`, connection);
        if (syncLogTableExists) {
            console.log(`Table sync_log already exists. Skipping table creation.`);
        } else {
            console.log(`Table sync_log does not exist. Creating table...`);
            await createSyncLogTable(connection);
        }

    } catch (error) {
        console.error('Error syncing complete sheet data:', error);
    }
};

const createTableFromData = async (data, sheetName, connection) => {
    try {
        if (!Array.isArray(data)) {
            throw new Error('Data is not in the expected format.');
        }

        const maxColumns = Math.max(...data.map(row => row.length));

        // Generate column names and avoid empty names
        const columnNames = Array.from({ length: maxColumns }, (_, index) => {
            const name = getColumnLetter(index + 1);
            return name === '' ? `Column${index + 1}` : name;
        });

        // Create the primary table with dynamically generated columns
        let createTableQuery = `CREATE TABLE IF NOT EXISTS \`${sheetName}\` (id INT AUTO_INCREMENT PRIMARY KEY`;
        columnNames.forEach(name => {
            createTableQuery += `, \`${name}\` VARCHAR(255)`;
        });

        // Add the timestamp column with a default value of the current time
        createTableQuery += `, \`timestamp\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP`;

        createTableQuery += `);`;

        console.log('Creating table with query:', createTableQuery);

        // Execute the table creation query
        await new Promise((resolve, reject) => {
            connection.query(createTableQuery, (err, results) => {
                if (err) reject(err);
                resolve(results);
            });
        });

        // Insert data into the primary table
        for (const [index, row] of data.entries()) {
            let insertQuery = `INSERT INTO \`${sheetName}\` (id`;
            let valuesQuery = `VALUES (${index + 1}`;

            columnNames.forEach((name, colIndex) => {
                insertQuery += `, \`${name}\``;
                valuesQuery += `, '${(row[colIndex] || '').replace(/'/g, "''")}'`;
            });

            // Automatically include the current timestamp in the insert query
            insertQuery += `, \`timestamp\``;
            valuesQuery += `, CURRENT_TIMESTAMP`;

            insertQuery += `) `;
            valuesQuery += `);`;

            await new Promise((resolve, reject) => {
                connection.query(insertQuery + valuesQuery, (err, results) => {
                    if (err) reject(err);
                    resolve(results);
                });
            });
        }

        console.log(`Table ${sheetName} created and data inserted successfully.`);

        // Create triggers after the table is created and data is inserted
        await createTriggersForTable(sheetName, columnNames, connection);
    } catch (error) {
        console.error('Error creating table or inserting data:', error);
    }
};

const createSyncLogTable = async (connection) => {
    try {
        // Create the sync_log table with specific fields
        const createSyncLogQuery = `
            CREATE TABLE IF NOT EXISTS \`sync_log\` (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action_type VARCHAR(50),
                row_id INT,
                row_data JSON,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        console.log('Creating sync_log table with query:', createSyncLogQuery);

        await new Promise((resolve, reject) => {
            connection.query(createSyncLogQuery, (err, results) => {
                if (err) reject(err);
                resolve(results);
            });
        });

        console.log('sync_log table created successfully.');
    } catch (error) {
        console.error('Error creating sync_log table:', error);
    }
};


const pollSyncLog = async (connection, NGROK_URL) => {
    try {
        if (connection.state === 'disconnected') {
            console.log('Database is disconnected, reconnecting...');
            await connection.connect();
        }

        //check if sync_log table exists
        const tableExists = await checkTableExists('sync_log', connection);
        if (!tableExists) {
            console.log('sync_log table does not exist. Skipping polling...');
            return;
        }

        const [results] = await connection.promise().query('SELECT * FROM sync_log ORDER BY timestamp ASC');

        if(results.length === 0) return;

        for (const log of results) {
            const { id, action_type, row_id, row_data } = log;

            console.log('Processing sync log entry:',id, action_type, row_id, row_data);

            await axios.post(`${NGROK_URL}/db-webhook`, {
                id,
                action_type,
                row_id,
                row_data,
            });

            await connection.promise().query('DELETE FROM sync_log WHERE id = ?', [log.id]);
            console.log('Processed and deleted sync log entry:', log.id);
        }
    } catch (error) {
        console.error('Error in polling sync log:', error);
    }
};

const createTriggersForTable = async (sheetName, columnNames, connection) => {
    if (sheetName === 'sync_log') {
        console.log('Triggers will not be created for secondary table.');
        return;
    }

    console.log('Creating triggers for table:', sheetName);
    try {
        console.log({ columnNames, sheetName });

        // Trigger to insert into sync_log on row insert
        const insertTriggerQuery = `
            CREATE TRIGGER \`${sheetName}_insert_trigger\`
            AFTER INSERT ON \`${sheetName}\`
            FOR EACH ROW
            BEGIN
                INSERT INTO sync_log (action_type, row_id, row_data, timestamp)
                VALUES ('insert', NEW.id, JSON_OBJECT(
                    ${columnNames.map(name => `'${name}', NEW.${name}`).join(', ')}
                ), NEW.timestamp);
            END;
        `;

        // Trigger to insert into sync_log on row update
        const updateTriggerQuery = `
            CREATE TRIGGER \`${sheetName}_update_trigger\`
            AFTER UPDATE ON \`${sheetName}\`
            FOR EACH ROW
            BEGIN
                INSERT INTO sync_log (action_type, row_id, row_data, timestamp)
                VALUES ('update', NEW.id, JSON_OBJECT(
                    ${columnNames.map(name => `'${name}', NEW.${name}`).join(', ')}
                ), NEW.timestamp);
            END;
        `;

        // Trigger to insert into sync_log on row delete
        const deleteTriggerQuery = `
            CREATE TRIGGER \`${sheetName}_delete_trigger\`
            AFTER DELETE ON \`${sheetName}\`
            FOR EACH ROW
            BEGIN
                INSERT INTO sync_log (action_type, row_id, row_data, timestamp)
                VALUES ('delete', OLD.id, JSON_OBJECT(
                    ${columnNames.map(name => `'${name}', OLD.${name}`).join(', ')}
                ), NOW()); -- Use current timestamp for deletions
            END;
        `;

        // Execute all the trigger creation queries
        await connection.promise().query(insertTriggerQuery);
        await connection.promise().query(updateTriggerQuery);
        await connection.promise().query(deleteTriggerQuery);

        console.log('Triggers created successfully.');
    } catch (error) {
        console.error('Error creating triggers:', error);
    }
};


module.exports = {
    syncCompleteSheet,
    pollSyncLog
};
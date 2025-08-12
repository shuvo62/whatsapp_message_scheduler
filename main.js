// main.js

const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');
const { scheduleMessage, setMainWindow, refreshContactsAndGroups, clientReady } = require('./scheduler');

const CONTACTS_CSV = path.join(__dirname, 'contacts.csv');
const GROUPS_CSV = path.join(__dirname, 'groups.csv');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        }
    });

    mainWindow.loadFile('index.html');
    setMainWindow(mainWindow);

    // schedule-message handler
    ipcMain.handle('schedule-message', async (_, data) => {
        try {
            const result = await scheduleMessage(data);
            return { success: true, status: result.status };
        } catch (err) {
            return { success: false, status: err.status || err.message || 'Unknown error' };
        }
    });

    // get-contacts: returns array of { Name, Value, Type }
    ipcMain.handle('get-contacts', async () => {
        const contacts = [];
        // if CSVs missing, trigger refresh (wait until done)
        if (!fs.existsSync(CONTACTS_CSV) || !fs.existsSync(GROUPS_CSV)) {
            try {
                await refreshContactsAndGroups();
            } catch (err) {
                console.error('Failed to refresh contacts:', err);
            }
        }

        const loadCSV = (filePath) => {
            return new Promise((resolve, reject) => {
                const rows = [];
                if (!fs.existsSync(filePath)) return resolve(rows);
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row) => rows.push(row))
                    .on('end', () => resolve(rows))
                    .on('error', reject);
            });
        };

        try {
            const contactRows = await loadCSV(CONTACTS_CSV);
            const groupRows = await loadCSV(GROUPS_CSV);

            // Only add contacts with valid numbers (no @c.us, only plain numbers)
            contactRows.forEach(r => {
                const number = r.Number || '';
                if (/^\d{8,}$/.test(number)) {
                    contacts.push({ Name: r.Name || '', Value: number, Type: 'contact' });
                }
            });

            // Only add groups with valid @g.us ID
            groupRows.forEach(r => {
                const groupId = r.ID || '';
                if (/@g\.us$/.test(groupId)) {
                    contacts.push({ Name: r.Name || r.GroupName || '', Value: groupId, Type: 'group' });
                }
            });

            return contacts;
        } catch (err) {
            console.error('Error loading CSVs:', err);
            return contacts;
        }
    });

    // Manual refresh from UI
    ipcMain.handle('refresh-contacts', async () => {
        try {
            await refreshContactsAndGroups();
            return { success: true, message: 'Contacts refreshed' };
        } catch (err) {
            return { success: false, message: err.message || String(err) };
        }
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});
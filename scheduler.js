// scheduler.js

const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const schedule = require('node-schedule');
const { createObjectCsvWriter } = require('csv-writer');

const CONTACTS_CSV = path.join(__dirname, 'contacts.csv');
const GROUPS_CSV = path.join(__dirname, 'groups.csv');

let clientReady = false;
let mainWindow = null;
let jobQueue = [];

function setMainWindow(win) {
    mainWindow = win;
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
});

client.on('qr', (qr) => {
    if (mainWindow) {
        mainWindow.webContents.send('qr-code', qr);
    }
});

client.on('ready', async () => {
    console.log('✅ WhatsApp client ready.');
    clientReady = true;
    try {
        await fetchAndSaveContactsAndGroups();
    } catch (err) {
        console.error('Failed to fetch contacts on ready:', err);
    }
    jobQueue.forEach(fn => fn());
    jobQueue = [];
});

client.on('auth_failure', (msg) => {
    console.error('❌ Authentication failed:', msg);
    if (mainWindow) {
        mainWindow.webContents.send('message-status', { message: '❌ Auth failed. Re-scan QR.' });
    }
});

client.on('disconnected', (reason) => {
    console.log('🔌 WhatsApp disconnected:', reason);
    clientReady = false;
    if (mainWindow) {
        mainWindow.webContents.send('message-status', { message: '🔌 WhatsApp disconnected.' });
    }
});

client.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp client:', err);
});

async function ensureClientReadyOrWait() {
    if (clientReady) return;
    return new Promise((resolve, reject) => {
        jobQueue.push(() => resolve());
        setTimeout(() => {
            if (!clientReady) reject(new Error('WhatsApp client not ready after timeout'));
        }, 60000);
    });
}

// Only save number (no @c.us) and name for contacts; only save group id (@g.us) and name for groups
async function fetchAndSaveContactsAndGroups() {
    if (!clientReady) {
        await ensureClientReadyOrWait();
    }

    const contacts = await client.getContacts();
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup);

    // Only save contact numbers (no IDs)
    const contactRecords = contacts
        .filter(c => c.id && c.id.user && /^\d+$/.test(c.id.user))
        .map(c => ({
            Name: c.name || c.pushname || '',
            Number: c.id.user
        }));

    // Only save group ids (ending in @g.us) and names
    const groupRecords = groups
        .filter(g => g.id && typeof g.id._serialized === 'string' && /@g\.us$/.test(g.id._serialized))
        .map(g => ({
            Name: g.name || '',
            GroupName: g.name || '',
            ID: g.id._serialized
        }));

    // Write CSVs
    const contactWriter = createObjectCsvWriter({
        path: CONTACTS_CSV,
        header: [
            { id: 'Name', title: 'Name' },
            { id: 'Number', title: 'Number' }
        ]
    });

    const groupWriter = createObjectCsvWriter({
        path: GROUPS_CSV,
        header: [
            { id: 'Name', title: 'Name' },
            { id: 'GroupName', title: 'GroupName' },
            { id: 'ID', title: 'ID' }
        ]
    });

    await contactWriter.writeRecords(contactRecords);
    await groupWriter.writeRecords(groupRecords);

    console.log(`✅ Saved ${contactRecords.length} contacts and ${groupRecords.length} groups to CSV.`);
    if (mainWindow) {
        mainWindow.webContents.send('message-status', { message: `✅ Saved ${contactRecords.length} contacts and ${groupRecords.length} groups to CSV.` });
    }
}

async function refreshContactsAndGroups() {
    try {
        if (!clientReady) {
            await ensureClientReadyOrWait();
        }
        await fetchAndSaveContactsAndGroups();
    } catch (err) {
        console.error('refreshContactsAndGroups error:', err);
        throw err;
    }
}

function scheduleMessage(data) {
    return new Promise((resolve, reject) => {
        if (clientReady) {
            scheduleNow(data, resolve, reject);
        } else {
            jobQueue.push(() => scheduleNow(data, resolve, reject));
            resolve({ status: 'Queued until WhatsApp client is ready.' });
        }
    });
}

async function scheduleNow({ mode, target, message, hour, minute, day, month, year, daily }, resolve, reject) {
    let chatId;
    try {
        if (mode === 'contact') {
            // Only allow pure number
            const cleaned = target.replace(/\D/g, '');
            if (!cleaned) return reject({ status: `❌ Invalid contact: ${target}` });
            chatId = `${cleaned}@c.us`;
            const isRegistered = await client.isRegisteredUser(chatId);
            if (!isRegistered) return reject({ status: `❌ ${target} is not on WhatsApp.` });
        } else if (mode === 'group') {
            // Only allow group id ending with @g.us
            if (!/@g\.us$/.test(target)) {
                return reject({ status: `❌ Invalid group id: ${target}` });
            }
            chatId = target.trim();
        } else {
            return reject({ status: '❌ Invalid mode.' });
        }
    } catch (err) {
        return reject({ status: '❌ Error resolving chat: ' + (err.message || err) });
    }

    const label = mode === 'contact' ? `Contact ${target}` : `Group ${target}`;

    const send = () => {
        client.sendMessage(chatId, message)
            .then(() => {
                console.log(`✅ Sent to ${label}`);
                if (mainWindow) {
                    mainWindow.webContents.send('message-status', {
                        target,
                        label,
                        success: true,
                        message: `✅ Message sent successfully to ${label}`
                    });
                }
            })
            .catch(err => {
                console.error(`❌ Failed to send to ${label}:`, err.message || err);
                if (mainWindow) {
                    mainWindow.webContents.send('message-status', {
                        target,
                        label,
                        success: false,
                        message: `❌ Failed to send to ${label}: ${err.message || err}`
                    });
                }
            });
    };

    if (daily) {
        const cron = `${minute} ${hour} * * *`;
        schedule.scheduleJob(cron, send);
        return resolve({ status: `📆 Daily message scheduled for ${label}` });
    } else {
        const sendDate = new Date(year, month - 1, day, hour, minute);
        if (sendDate < new Date()) return reject({ status: `❌ Date/time is in the past for ${label}` });
        schedule.scheduleJob(sendDate, send);
        return resolve({ status: `📆 One-time message scheduled on ${sendDate.toLocaleString()} for ${label}` });
    }
}

module.exports = {
    scheduleMessage,
    setMainWindow,
    refreshContactsAndGroups,
    clientReady
};
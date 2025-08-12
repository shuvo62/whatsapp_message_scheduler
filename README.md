# 📆 WhatsApp Message Scheduler (Electron App)

A desktop app for scheduling WhatsApp messages to contacts or groups using [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), built with Electron.

## ✨ Features

- **Schedule messages** to individual contacts (by number) or groups (by {group_ID}@g.us)
- **Repeat daily** or send at a specific date/time
- **Import and search contacts/groups** (auto-fetched from your WhatsApp account)
- **QR code login** for WhatsApp Web session
- **CSV export** for contacts and group info
- **Modern, easy-to-use UI** with live status and error feedback

## 🖼️ Screenshots

![Main UI](screenshot.png)

## ⚙️ Usage

### 1. **Install Dependencies**

```bash
npm install
```

### 2. **Start the App**

```bash
npm start
```

### 3. **Log in to WhatsApp**

- On first run, scan the QR code using WhatsApp on your phone (Menu > Linked Devices > Link a Device).

### 4. **Schedule a Message**

- Select mode: Contact, Group, or Both.
- Search and select a contact (by number) or group (by group ID, ending with `@g.us`).
- Type your message, select date/time or set to repeat daily.
- Click "Schedule Message".

### 5. **Contact & Group Format**

- **Contacts:** Only phone numbers (e.g., `8801XXXXXXX`), no `@c.us` suffixes.
- **Groups:** Only group IDs (e.g., `120363420729794821@g.us`), no group names.

The app **does not save WhatsApp IDs for contacts** (only numbers) and **does not save group names as group values** (only group IDs).

## 📁 Files

- `index.html`: Main UI (Electron renderer)
- `renderer.js`: Frontend JS logic (UI events, IPC, QR code, etc.)
- `main.js`: Electron main process (window, IPC handlers)
- `scheduler.js`: WhatsApp client, CSV export, message scheduling logic
- `contacts.csv`: Exported contacts (`Name`, `Number`)
- `groups.csv`: Exported groups (`Name`, `GroupName`, `ID`)

## 📝 CSV Export Example

**contacts.csv**

```csv
Name,Number
John Doe,880123456789
Jane Smith,880198765432
```

**groups.csv**

```csv
Name,GroupName,ID
Family Group,Family Group,120363420729794821@g.us
Best Friends,Best Friends,120398765432198@g.us
```

## 💡 Notes

- Only unique phone numbers are saved for contacts (no duplicates).
- Only unique group IDs are saved for groups.
- You must keep your WhatsApp running and connected for scheduled messages to send.
- The app uses local authentication (no WhatsApp credentials are ever stored).

## 🛠️ Dependencies

- [Electron](https://www.electronjs.org/)
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)
- [node-schedule](https://www.npmjs.com/package/node-schedule)
- [csv-writer](https://www.npmjs.com/package/csv-writer)
- [qrcode](https://www.npmjs.com/package/qrcode)

## 🛡️ Disclaimer

This project is for **educational and personal use only**. Automated WhatsApp messaging may violate WhatsApp's terms of service. Use responsibly.

// renderer.js

const { ipcRenderer } = require('electron');
const QR = require('qrcode');

let contactList = [];

async function loadContacts(showLoader = true) {
  const loader = document.getElementById('fullScreenLoader');
  if (showLoader) loader.style.display = 'flex';

  try {
    const contactsPromise = ipcRenderer.invoke('get-contacts');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout fetching contacts')), 15000)
    );

    contactList = await Promise.race([contactsPromise, timeoutPromise]);
    renderContactOptions();
  } catch (err) {
    console.error("❌ Failed to load contacts/groups:", err);
    appendStatus(`❌ Failed to load contacts: ${err.message || err}`);
  } finally {
    if (showLoader) loader.style.display = 'none';
  }
}

function renderContactOptions(filter = "") {
  const contactGroup = document.getElementById('contactsGroup');
  const groupGroup = document.getElementById('groupsGroup');
  contactGroup.innerHTML = "";
  groupGroup.innerHTML = "";

  contactList.forEach(({ Name, Value, Type }) => {
    const display = `${Name} (${Value})`;
    const text = display.toLowerCase();
    if (text.includes(filter.toLowerCase())) {
      const option = document.createElement('option');
      option.value = Value;
      option.textContent = display;
      if ((Type || '').toLowerCase() === "group") {
        groupGroup.appendChild(option);
      } else {
        contactGroup.appendChild(option);
      }
    }
  });

  // restore selected from localStorage
  const saved = JSON.parse(localStorage.getItem("selectedContacts") || "[]");
  const picker = document.getElementById("contactPicker");
  Array.from(picker.options).forEach(opt => {
    if (saved.includes(opt.value)) opt.selected = true;
  });
}

function filterContacts() {
  const search = document.getElementById("searchBox").value;
  renderContactOptions(search);
}

function addSelectedContacts() {
  const picker = document.getElementById('contactPicker');
  const textarea = document.getElementById('target');
  const selected = Array.from(picker.selectedOptions).map(opt => opt.value);
  const existing = textarea.value.trim();
  const combined = [...(existing ? existing.split('\n') : []), ...selected];
  textarea.value = [...new Set(combined)].join('\n');

  localStorage.setItem("selectedContacts", JSON.stringify(selected));
}

window.schedule = async function () {
  const mode = document.getElementById('mode').value;
  const targetsRaw = document.getElementById('target').value.trim();
  const message = document.getElementById('message').value.trim();
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const daily = document.getElementById('daily').checked;

  if (!targetsRaw || !message || !time || (!daily && !date)) {
    appendStatus('⚠️ Please fill in all required fields.');
    return;
  }

  const targets = targetsRaw.split('\n').map(t => t.trim()).filter(Boolean);
  const [hour, minute] = time.split(':').map(Number);
  let year, month, day;

  if (!daily) {
    [year, month, day] = date.split('-').map(Number);
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth() + 1;
    day = now.getDate();
  }

  appendStatus(`⏳ Scheduling for ${targets.length} recipient(s)...`);

  for (const target of targets) {
    let targetMode = mode;
    if (mode === 'both') {
      const clean = target.replace(/[^0-9]/g, '');
      targetMode = (clean.length >= 10 && clean.length <= 15) ? 'contact' : 'group';
    }

    try {
      const result = await ipcRenderer.invoke('schedule-message', {
        mode: targetMode,
        target,
        message,
        hour,
        minute,
        day,
        month,
        year,
        daily
      });

      if (result.success) {
        appendStatus(`✅ ${targetMode.toUpperCase()} "${target}" → ${result.status}`);
      } else {
        appendStatus(`❌ ${targetMode.toUpperCase()} "${target}" → ${result.status}`);
      }
    } catch (err) {
      appendStatus(`❌ Error for "${target}": ${err.message || err}`);
    }
  }
};

function appendStatus(text) {
  const statusEl = document.getElementById('status');
  const now = new Date().toLocaleTimeString();
  statusEl.innerText = `${statusEl.innerText}\n[${now}] ${text}`;
  statusEl.scrollTop = statusEl.scrollHeight;
}

ipcRenderer.on('message-status', (_, data) => {
  appendStatus(data.message || JSON.stringify(data));
});

// QR code listener (draw on canvas)
ipcRenderer.on('qr-code', (_, qrString) => {
  const canvas = document.getElementById('qrCanvas');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  QR.toCanvas(canvas, qrString, { width: 220 }, (err) => {
    if (err) {
      console.error('QR render error', err);
      appendStatus(`❌ QR render error: ${err.message || err}`);
    } else {
      appendStatus('🔐 QR code updated — scan with WhatsApp.');
    }
  });
});

// click refresh button with full screen loader & timeout fallback
async function refreshContacts() {
  const refreshBtn = document.getElementById('refreshBtn');
  const loader = document.getElementById('fullScreenLoader');

  loader.style.display = 'flex';
  refreshBtn.disabled = true;

  appendStatus('🔄 Refreshing contacts/groups (this may take a few seconds)...');

  const fallbackTimeout = setTimeout(() => {
    loader.style.display = 'none';
    refreshBtn.disabled = false;
  }, 20000); // 20 seconds fallback

  try {
    const res = await ipcRenderer.invoke('refresh-contacts');
    if (res && res.success) {
      appendStatus('✅ Contacts refreshed. Reloading list...');
      await loadContacts(false); // Don't double-show loader
    } else {
      appendStatus(`❌ Refresh failed: ${res.message || JSON.stringify(res)}`);
    }
  } catch (err) {
    appendStatus(`❌ Refresh error: ${err.message || err}`);
  } finally {
    clearTimeout(fallbackTimeout);
    loader.style.display = 'none';
    refreshBtn.disabled = false;
  }
}

window.onload = () => {
  // Set up date visibility and today's date
  if (typeof toggleDateVisibility === "function") toggleDateVisibility();
  const today = new Date().toLocaleDateString('en-CA');
  document.getElementById("date").value = today;
  loadContacts(true);
};

window.addSelectedContacts = addSelectedContacts;
window.filterContacts = filterContacts;
window.refreshContacts = refreshContacts;
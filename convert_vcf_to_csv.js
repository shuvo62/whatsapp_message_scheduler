const fs = require('fs');

const vcfPath = 'contacts.vcf';
const csvPath = 'contacts.csv';

const vcfContent = fs.readFileSync(vcfPath, 'utf8');
const entries = vcfContent.split(/END:VCARD/i);

let csv = 'Name,Phone\n';
const seen = new Set();

entries.forEach(entry => {
    const nameMatch = entry.match(/FN.*?:([^\r\n]+)/i);
    if (!nameMatch) return;
    const name = nameMatch[1].trim().replace(/,/g, '');

    // Match all TEL lines
    const telLines = entry.match(/TEL[^:\n]*:[^\n]+/gi);
    if (!telLines) return;

    telLines.forEach(telLine => {
        let raw = telLine.split(':').pop().trim(); // everything after the colon

        // Remove `tel:` if present
        if (raw.toLowerCase().startsWith('tel:')) {
            raw = raw.slice(4);
        }

        // Remove spaces, dashes, brackets
        let phone = raw.replace(/[\s\-()]/g, '');

        // Normalize BD local numbers (01XXXXXXXXX → 8801XXXXXXXX)
        if (/^01\d{9}$/.test(phone)) {
            phone = '880' + phone.slice(1);
        }

        // Remove leading '+' if present
        if (phone.startsWith('+')) {
            phone = phone.slice(1);
        }

        // Accept if valid
        if (/^\d{10,20}$/.test(phone) && !seen.has(phone)) {
            csv += `"${name}","${phone}"\n`;
            seen.add(phone);
        }
    });
});

fs.writeFileSync(csvPath, csv);
console.log(`✅ Extracted ${seen.size} contacts to ${csvPath}`);

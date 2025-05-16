const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { fromPath } = require('pdf-poppler');
const Tesseract = require('tesseract.js');

// Time config
const RELAY_HEAT_GAP = 90;
const NORMAL_HEAT_GAP = 60;
const TRANSITION_TIME = 180;

// Output folder for images
const OUTPUT_DIR = './ocr_pages';
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Convert time strings to seconds
function parseTime(str) {
    if (!str) return 0;
    if (str.includes(':')) {
        const [min, sec] = str.split(':');
        return parseFloat(min) * 60 + parseFloat(sec);
    }
    return parseFloat(str);
}

// Extract time-like strings from text
function extractTimes(text) {
    const matches = [...text.matchAll(/\b\d+:\d{2}\.\d{2}\b|\b\d{1,2}\.\d{2}\b/g)];
    return matches.map(match => parseTime(match[0]));
}

async function runOCRonPDF(pdfPath) {
    console.log(`📄 Converting and OCRing PDF: ${pdfPath}`);

    const opts = {
        format: 'jpeg',
        out_dir: OUTPUT_DIR,
        out_prefix: 'page',
        page: null,
    };

    await fromPath(pdfPath, opts);

    const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.jpg'));

    let allText = '';
    for (const file of files) {
        const imagePath = path.join(OUTPUT_DIR, file);
        const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
            logger: m => process.stdout.write(`\r🔍 OCR ${file} - ${m.status} ${Math.round(m.progress * 100)}%`)
        });
        allText += '\n' + text;
    }

    return allText;
}

(async () => {
    const text = await runOCRonPDF('./Manage IESA 4A - Sectional 2 @ Wheeling HS.pdf');
    const lines = text.split('\n').map(l => l.trim());

    const eventMap = {};
    let currentEvent = null;
    let currentHeat = [];

    for (const line of lines) {
        if (line.match(/^#\d+\s+/)) {
            if (currentEvent && currentHeat.length > 0) {
                eventMap[currentEvent].push([...currentHeat]);
                currentHeat = [];
            }
            const eventName = line.replace(/^#\d+\s+/, '').replace(/Finals/i, '').trim();
            currentEvent = eventName;
            eventMap[currentEvent] = [];
        } else if (line.toLowerCase().startsWith('heat')) {
            if (currentHeat.length > 0 && currentEvent) {
                eventMap[currentEvent].push([...currentHeat]);
                currentHeat = [];
            }
        } else {
            const times = extractTimes(line);
            if (times.length) currentHeat.push(...times);
        }
    }

    if (currentEvent && currentHeat.length > 0) {
        eventMap[currentEvent].push([...currentHeat]);
    }

    // Estimate time
    let totalSeconds = 0;
    for (const [event, heats] of Object.entries(eventMap)) {
        const gap = event.toLowerCase().includes('relay') ? RELAY_HEAT_GAP : NORMAL_HEAT_GAP;
        heats.forEach((heat, idx) => {
            const slowest = Math.max(...heat);
            totalSeconds += slowest;
            if (idx < heats.length - 1) totalSeconds += gap;
        });
        totalSeconds += TRANSITION_TIME;
    }

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    console.log(`\n⏱ Estimated Total Meet Time: ${hours}h ${minutes}m ${seconds}s`);
})();

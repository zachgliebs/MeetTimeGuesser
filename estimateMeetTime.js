const fs = require("fs");
const { fromPath } = require("pdf2pic");
const Tesseract = require("tesseract.js");
const path = require("path");

const RELAY_HEAT_GAP = 90;
const NORMAL_HEAT_GAP = 60;
const TRANSITION_TIME = 180;

// Create output dir
const OUTPUT_DIR = "./output_images";
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Time parsers
function parseTime(str) {
    if (!str) return 0;
    if (str.includes(":")) {
        const [min, sec] = str.split(":");
        return parseFloat(min) * 60 + parseFloat(sec);
    }
    return parseFloat(str);
}

function extractTimes(text) {
    const matches = [...text.matchAll(/\b\d+:\d{2}\.\d{2}\b|\b\d{1,2}\.\d{2}\b/g)];
    return matches.map(m => parseTime(m[0]));
}

// Convert PDF to images
async function convertPdfToImages(pdfPath) {
    const convert = fromPath(pdfPath, {
        density: 150,
        saveFilename: "page",
        savePath: OUTPUT_DIR,
        format: "png",
        width: 1200,
        height: 1600,
    });

    const pages = await convert.bulk(-1); // convert all pages
    return pages.map(p => p.path);
}

// OCR one image
async function ocrImage(imagePath) {
    const { data: { text } } = await Tesseract.recognize(imagePath, "eng", {
        logger: m => process.stdout.write(`\rOCR ${path.basename(imagePath)} - ${Math.round(m.progress * 100)}%`)
    });
    return text;
}

async function main() {
    const pdfPath = "./Manage IESA 4A - Sectional 2 @ Wheeling HS.pdf";
    const imagePaths = await convertPdfToImages(pdfPath);

    let allText = "";
    for (const imagePath of imagePaths) {
        const text = await ocrImage(imagePath);
        allText += "\n" + text;
    }

    const lines = allText.split("\n").map(l => l.trim());
    const eventMap = {};
    let currentEvent = null;
    let currentHeat = [];

    for (const line of lines) {
        if (line.match(/^#\d+\s/)) {
            if (currentEvent && currentHeat.length > 0) {
                eventMap[currentEvent].push([...currentHeat]);
                currentHeat = [];
            }
            const eventName = line.replace(/^#\d+\s+/, '').replace(/Finals/i, '').trim();
            currentEvent = eventName;
            eventMap[currentEvent] = [];
        } else if (line.toLowerCase().startsWith("heat")) {
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

    // Estimate total meet time
    let totalSeconds = 0;
    for (const [event, heats] of Object.entries(eventMap)) {
        const gap = event.toLowerCase().includes("relay") ? RELAY_HEAT_GAP : NORMAL_HEAT_GAP;
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

    // Output
    console.log("\n📊 Meet Breakdown:");
    for (const [event, heats] of Object.entries(eventMap)) {
        console.log(`\n${event}`);
        heats.forEach((heat, idx) => {
            const slowest = Math.max(...heat).toFixed(2);
            console.log(`  Heat ${idx + 1}: slowest time ${slowest}s`);
        });
    }

    console.log(`\n⏱ Estimated Total Meet Time: ${hours}h ${minutes}m ${seconds}s`);
}

main();

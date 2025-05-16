const fs = require('fs');
const pdf = require('pdf-parse');

// Adjustable time variables (in seconds)
const RELAY_HEAT_GAP = 90;
const NORMAL_HEAT_GAP = 60;
const TRANSITION_TIME = 180;

const isRelay = (eventName) => eventName.toLowerCase().includes('relay');

// Parse a time string (like 1:03.14 or 13.44) into seconds
function parseTime(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(timeStr);
}

// Extract valid time strings from text
function extractTimes(text) {
    const regex = /(\d+:\d{2}\.\d{2}|\d{1,2}\.\d{2})/g;
    return [...text.matchAll(regex)].map(match => match[0]);
}

(async () => {
    const dataBuffer = fs.readFileSync('./Manage IESA 4A - Sectional 2 @ Wheeling HS.pdf');
    const data = await pdf(dataBuffer);
    const lines = data.text.split('\n');

    const eventMap = {};
    let currentEvent = null;
    let currentHeats = [];
    let heatTimes = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Detect new event
        const eventMatch = trimmed.match(/^#\d+\s+(.+?)\s+Finals$/);
        if (eventMatch) {
            if (currentEvent && heatTimes.length > 0) {
                currentHeats.push(heatTimes);
                eventMap[currentEvent] = currentHeats;
            }

            currentEvent = eventMatch[1];
            currentHeats = [];
            heatTimes = [];
            continue;
        }

        // Detect new heat
        if (/^Heat \d+/.test(trimmed)) {
            if (heatTimes.length > 0) {
                currentHeats.push(heatTimes);
                heatTimes = [];
            }
            continue;
        }

        // Extract times from current line
        if (currentEvent) {
            const times = extractTimes(trimmed);
            if (times.length > 0) {
                heatTimes.push(...times);
            }
        }
    }

    // Final heat push
    if (currentEvent && heatTimes.length > 0) {
        currentHeats.push(heatTimes);
        eventMap[currentEvent] = currentHeats;
    }

    // Estimate total meet time
    let totalSeconds = 0;

    for (const [event, heats] of Object.entries(eventMap)) {
        const gap = isRelay(event) ? RELAY_HEAT_GAP : NORMAL_HEAT_GAP;

        heats.forEach((heat, idx) => {
            const slowest = heat.reduce((max, t) => Math.max(max, parseTime(t)), 0);
            totalSeconds += slowest;
            if (idx < heats.length - 1) totalSeconds += gap;
        });

        totalSeconds += TRANSITION_TIME;
    }

    // Convert to HH:MM:SS
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    // Output
    console.log(`\n📊 Meet Analysis:`);
    for (const [event, heats] of Object.entries(eventMap)) {
        console.log(`\n${event}`);
        heats.forEach((heat, i) => {
            const slowest = heat.reduce((max, t) => Math.max(max, parseTime(t)), 0);
            console.log(`  Heat ${i + 1}: ${slowest.toFixed(2)}s`);
        });
    }

    console.log(`\n⏱ Estimated Total Meet Time: ${hours}h ${minutes}m ${seconds}s`);
})();

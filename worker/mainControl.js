import * as axios from "axios";
import * as cheerio from "cheerio";
// ------------------------------
// CONFIG
const RELAY_HEAT_GAP = 90;
const NORMAL_HEAT_GAP = 60;
const TRANSITION_TIME = 180;
const BLOB_BASE = "https://athleticlive.blob.core.windows.net/$web";
// ------------------------------

async function getAllMeetIds() {
    const url = "https://live.athletic.net/meet-list";
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const meetIds = [];
        $('a.meet-tile').each((i, el) => {
            const href = $(el).attr('href') || '';
            const match = href.match(/\/meet\/(\d+)/);
            if (match) {
                meetIds.push(match[1]);
            }
        });
        return meetIds;
    } catch (err) {
        console.error("❌ Failed to fetch meet list.");
        return [];
    }
}

function extractEventsFromHtml(html) {
    const $ = cheerio.load(html);
    const events = [];
    $('a[href*="/meets/"]').each((i, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/\/meets\/\d+\/events\/(relay|rel|individual)\/(\d+)/);
        if (!match) return;
        const [, category, eventId] = match;
        const nameTag = $(el).find('h6').first();
        const gradeTag = $(el).find('app-event-name-secondary div').first();
        const name = nameTag.text().trim() || 'Unknown Event';
        const grade = gradeTag.text().trim() || '';
        const fullName = `${name} ${grade}`.trim();
        events.push({
            id: eventId,
            category,
            name: fullName,
            relay: ['relay', 'rel'].includes(category)
        });
    });
    return events;
}

function parseTime(t) {
    const parts = t.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(t);
}



async function getHeatData(eventId, isRelay) {
    const listType = isRelay ? 'rel' : 'ind';
    const jsonUrl = `${BLOB_BASE}/${listType}_heat_list/_doc/${eventId}`;
    try {
        const res = await axios.get(jsonUrl);
        const source = res.data._source || {};
        const heats = {};
        const entries = source[isRelay ? 'rtn' : 'it'] || [];
        for (const entry of entries) {
            const heatNum = entry.hn;
            const timeStr = entry.s;
            if (heatNum && timeStr) {
                try {
                    if (!heats[heatNum]) heats[heatNum] = [];
                    heats[heatNum].push(parseTime(timeStr));
                } catch (e) { }
            }
        }
        return heats;
    } catch (err) {
        return {};
    }
}

function estimateTotalTime(eventData) {
    let total = 0;
    for (const event of eventData) {
        const heats = event.heats;
        const gap = event.relay ? RELAY_HEAT_GAP : NORMAL_HEAT_GAP;
        const heatNums = Object.keys(heats).sort((a, b) => a - b);
        for (let i = 0; i < heatNums.length; i++) {
            const heatNum = heatNums[i];
            const times = heats[heatNum];
            if (times && times.length) {
                total += Math.max(...times);
                if (i < heatNums.length - 1) {
                    total += gap;
                }
            }
        }
        total += TRANSITION_TIME;
    }
    return total;
}

export default async function main(id) {
    let output = "";
    const url = "https://live.athletic.net/meets/";
    try {
        const newURL = url + id;
        const response = await axios.get(newURL);
        const $ = cheerio.load(response.data);
        
        extractEventsFromHtml($('#meetContainer').html());

        output += ("\n🔍 Reading event list from HTML...");
        output += (`\n✅ Found ${events.length} events.`);
        const allEventData = [];
        for (const event of events) {
            output += (`\n📘 ${event.name} (${event.relay ? 'Relay' : 'Individual'})`);
            const heats = await getHeatData(event.id, event.relay);
            if (!Object.keys(heats).length) {
                output += ("\n  ⚠️ No heats found.");
                continue;
            }
            const heatNums = Object.keys(heats).sort((a, b) => a - b);
            for (const heatNum of heatNums) {
                const times = heats[heatNum];
                if (times && times.length) {
                    output += (`\n  Heat ${heatNum}: slowest time ${Math.max(...times).toFixed(2)}s`);
                }
            }
            allEventData.push({
                name: event.name,
                relay: event.relay,
                heats
            });
        }

        const total = estimateTotalTime(allEventData);
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = Math.floor(total % 60);
        output += (`\n⏱ Estimated Total Meet Time: ${h}h ${m}m ${s}s`);

        const meetIds = await getAllMeetIds();
        output += (`\nFound: ${JSON.stringify(meetIds)}`);
    } catch (err) {
        output += ("\n❌ Failed to fetch innerHTML.");
    }

    return output;
}
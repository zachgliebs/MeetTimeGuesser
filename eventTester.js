const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('events.html', 'utf-8');
const $ = cheerio.load(html);

const eventData = [];

$('a[href*="/meets/"]').each((_, aTag) => {
    const href = $(aTag).attr('href') || '';
    const match = href.match(/\/meets\/\d+\/events\/(relay|individual)\/(\d+)/);
    if (!match) return;

    const [, category, eventId] = match;
    const nameTag = $(aTag).find('h6').first();
    const gradeTag = $(aTag).find('app-event-name-secondary div').first();
    const name = nameTag.text().trim() || "Unknown Event";
    const grade = gradeTag.text().trim() || "";

    const fullName = `${name} ${grade}`.trim();
    eventData.push({
        id: eventId,
        category: category,
        name: fullName
    });
});

fs.writeFileSync('event_list.json', JSON.stringify(eventData, null, 2), 'utf-8');
console.log(`✅ Extracted ${eventData.length} events and saved to event_list.json`);

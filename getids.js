const axios = require('axios');

async function getAllMeetIdsFromApi(pages = 3) {
    const baseUrl = "https://live.athletic.net/api/v1/meets/upcoming";
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json"
    };

    const meetIds = [];

    for (let page = 1; page <= pages; page++) {
        const url = `${baseUrl}?country=US&page=${page}&pageSize=50`;
        try {
            const res = await axios.get(url, { headers });
            if (res.status !== 200) {
                console.log(`❌ Failed to fetch page ${page}: status ${res.status}`);
                continue;
            }
            const data = res.data;
            if (data && Array.isArray(data.results)) {
                for (const meet of data.results) {
                    if (meet && meet.id) {
                        meetIds.push(String(meet.id));
                    }
                }
            }
        } catch (err) {
            if (err.response) {
                console.log(`❌ Failed to fetch page ${page}: status ${err.response.status}`);
            } else if (err.request) {
                console.log(`❌ No response received for page ${page}`);
            } else {
                console.log(`❌ Error on page ${page}: ${err.message}`);
            }
            continue;
        }
    }

    return meetIds;
}

// Test the function
(async () => {
    const ids = await getAllMeetIdsFromApi();
    console.log(`✅ Found ${ids.length} meet IDs:`);
    console.log(ids);
})();

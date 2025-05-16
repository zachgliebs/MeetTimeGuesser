import requests
from bs4 import BeautifulSoup
import json
import re
from collections import defaultdict

# ------------------------------
# CONFIGURABLE
MEET_ID = "53543"
HTML_SOURCE_FILE = "events.html"
RELAY_HEAT_GAP = 90       # seconds
NORMAL_HEAT_GAP = 60      # seconds
TRANSITION_TIME = 180     # seconds
# ------------------------------

BLOB_BASE = "https://athleticlive.blob.core.windows.net/$web"

def parse_time(t):
    parts = t.split(":")
    return int(parts[0]) * 60 + float(parts[1]) if len(parts) == 2 else float(t)

def extract_events_from_html():
    with open(HTML_SOURCE_FILE, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    events = []
    for a_tag in soup.select('a[href*="/meets/"]'):
        href = a_tag.get("href", "")
        match = re.match(r"/meets/\d+/events/(relay|individual)/(\d+)", href)
        if not match:
            continue

        category, event_id = match.groups()
        name_tag = a_tag.select_one("h6")
        grade_tag = a_tag.select_one("app-event-name-secondary div")

        name = name_tag.get_text(strip=True) if name_tag else "Unknown Event"
        grade = grade_tag.get_text(strip=True) if grade_tag else ""
        full_name = f"{name} {grade}".strip()

        events.append({
            "id": event_id,
            "category": category,
            "name": full_name
        })

    return events

def get_heat_data(event_id, category):
    json_url = f"{BLOB_BASE}/{'relay' if category == 'relay' else 'ind'}_heat_list/_doc/{event_id}"
    res = requests.get(json_url)
    if res.status_code != 200:
        return {}
    source = res.json().get('_source', {})
    heats = defaultdict(list)
    for entry in source.get('it', []):
        heat_num = entry.get('hn')
        time_str = entry.get('s')
        if heat_num and time_str:
            try:
                heats[heat_num].append(parse_time(time_str))
            except:
                pass
    return heats

def estimate_total_time(event_data):
    total = 0
    for event in event_data:
        heats = event["heats"]
        gap = RELAY_HEAT_GAP if event["relay"] else NORMAL_HEAT_GAP
        for i, (heat_num, times) in enumerate(sorted(heats.items())):
            if times:
                total += max(times)
                if i < len(heats) - 1:
                    total += gap
        total += TRANSITION_TIME
    return total

def main():
    print("🔍 Reading event list from HTML...")
    events = extract_events_from_html()
    print(f"✅ Found {len(events)} events.")

    all_event_data = []
    for event in events:
        print(f"\n📘 {event['name']} ({event['category']})")
        heats = get_heat_data(event['id'], event['category'])
        if not heats:
            print("  ⚠️ No heats found.")
            continue
        for heat_num, times in sorted(heats.items()):
            if times:
                print(f"  Heat {heat_num}: slowest time {max(times):.2f}s")
        all_event_data.append({
            "name": event['name'],
            "relay": event['category'] == 'relay',
            "heats": heats
        })

    total = estimate_total_time(all_event_data)
    h, m, s = int(total // 3600), int((total % 3600) // 60), int(total % 60)
    print(f"\n⏱ Estimated Total Meet Time: {h}h {m}m {s}s")

if __name__ == "__main__":
    main()

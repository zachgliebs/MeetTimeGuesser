import requests
from bs4 import BeautifulSoup
import json
import re
from collections import defaultdict
from datetime import datetime

# ------------------------------
# CONFIG
MEET_ID = "53543"
HTML_SOURCE_FILE = "events.html"
RELAY_HEAT_GAP = 90
NORMAL_HEAT_GAP = 60
TRANSITION_TIME = 180
BLOB_BASE = "https://athleticlive.blob.core.windows.net/$web"
# ------------------------------

def get_all_meet_ids():
    url = "https://live.athletic.net/meet-list"
    response = requests.get(url)
    if response.status_code != 200:
        print("❌ Failed to fetch meet list.")
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    meet_ids = []

    for a in soup.select("a.meet-tile"):
        href = a.get("href", "")
        match = re.search(r"/meet/(\d+)", href)
        if match:
            meet_ids.append(match.group(1))

    return meet_ids

def parse_time(t):
    parts = t.split(":")
    return int(parts[0]) * 60 + float(parts[1]) if len(parts) == 2 else float(t)

def extract_events_from_html():
    with open(HTML_SOURCE_FILE, "r", encoding="utf-8") as f:
        soup = BeautifulSoup(f, "html.parser")

    events = []
    for a_tag in soup.select('a[href*="/meets/"]'):
        href = a_tag.get("href", "")
        match = re.match(r"/meets/\d+/events/(relay|rel|individual)/(\d+)", href)
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
            "name": full_name,
            "relay": category in ["relay", "rel"]
        })

    return events


def get_heat_data(event_id, is_relay):
    list_type = 'rel' if is_relay else 'ind'
    json_url = f"{BLOB_BASE}/{list_type}_heat_list/_doc/{event_id}"
    res = requests.get(json_url)
    if res.status_code != 200:
        return {}

    source = res.json().get('_source', {})
    heats = defaultdict(list)

    entries = source.get('rtn' if is_relay else 'it', [])

    for entry in entries:
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
        print(f"\n📘 {event['name']} ({'Relay' if event['relay'] else 'Individual'})")
        heats = get_heat_data(event['id'], event['relay'])
        if not heats:
            print("  ⚠️ No heats found.")
            continue
        for heat_num, times in sorted(heats.items()):
            if times:
                print(f"  Heat {heat_num}: slowest time {max(times):.2f}s")
        all_event_data.append({
            "name": event['name'],
            "relay": event['relay'],
            "heats": heats
        })

    total = estimate_total_time(all_event_data)
    h, m, s = int(total // 3600), int((total % 3600) // 60), int(total % 60)
    print(f"\n⏱ Estimated Total Meet Time: {h}h {m}m {s}s")
    meet_ids = get_all_meet_ids()
    print(f"Found: {meet_ids}")

if __name__ == "__main__":
    main()
    

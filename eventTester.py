from bs4 import BeautifulSoup
import json
import re

with open("events.html", "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

event_data = []

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
    event_data.append({
        "id": event_id,
        "category": category,
        "name": full_name
    })

# Save it to a JSON file
with open("event_list.json", "w", encoding="utf-8") as f:
    json.dump(event_data, f, indent=2)

print(f"✅ Extracted {len(event_data)} events and saved to event_list.json")

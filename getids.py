import requests

def get_all_meet_ids_from_api(pages=3):
    base_url = "https://live.athletic.net/api/v1/meets/upcoming"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json"
    }

    meet_ids = []

    for page in range(1, pages + 1):
        url = f"{base_url}?country=US&page={page}&pageSize=50"
        res = requests.get(url, headers=headers)

        if res.status_code != 200:
            print(f"❌ Failed to fetch page {page}: status {res.status_code}")
            continue

        try:
            data = res.json()
        except ValueError:
            print(f"❌ Failed to parse JSON on page {page}")
            continue

        for meet in data.get("results", []):
            meet_id = meet.get("id")
            if meet_id:
                meet_ids.append(str(meet_id))

    return meet_ids

# Test the function
if __name__ == "__main__":
    ids = get_all_meet_ids_from_api()
    print(f"✅ Found {len(ids)} meet IDs:")
    print(ids)

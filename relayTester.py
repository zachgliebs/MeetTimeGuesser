import requests
import json

relay_id = "356535"
url = f"https://athleticlive.blob.core.windows.net/$web/rel_heat_list/_doc/{relay_id}"

res = requests.get(url)
data = res.json()
source = data.get('_source', {})

for key in ['rtds', 'rre', 'rtn', 'rhn']:
    val = source.get(key)
    if val:
        print(f"\n✅ Key '{key}' found with {len(val)} entries. Sample:")
        print(json.dumps(val[:2], indent=2))
    else:
        print(f"❌ Key '{key}' is empty or missing.")

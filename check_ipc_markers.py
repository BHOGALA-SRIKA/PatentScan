import requests
from bs4 import BeautifulSoup

url = "https://patents.google.com/patent/US7991714B2/en"

response = requests.get(
    url,
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=30
)
response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")

cpc_codes = []

for item in soup.select('li[itemprop="classifications"]'):
    code_element = item.select_one('[itemprop="Code"]')
    marker = item.select_one('[itemprop="IsCPC"]')

    if not code_element:
        continue

    if marker and marker.get("content", "").lower() == "true":
        code = code_element.get_text(" ", strip=True)

        if code not in cpc_codes:
            cpc_codes.append(code)

print("CPC codes found:", len(cpc_codes))

for code in cpc_codes:
    print(code)
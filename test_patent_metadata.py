'''
from data_collection.collect_patents import get_patent_details

url = "https://patents.google.com/patent/US7991714B2/en"

result = get_patent_details(url)

for field, value in result.items():
    print(f"{field}: {value or 'Not found'}")
'''

import requests
from bs4 import BeautifulSoup

url = "https://patents.google.com/patent/US7991714B2/en"

response = requests.get(
    url,
    headers={
        "User-Agent": "Mozilla/5.0"
    },
    timeout=30
)
response.raise_for_status()

soup = BeautifulSoup(response.content, "html.parser")

# Find the Classifications section.
for section in soup.find_all("section"):
    heading = section.find(["h2", "h3"])

    if heading and "classification" in heading.get_text(
        " ", strip=True
    ).lower():

        print("\n--- CLASSIFICATIONS SECTION ---")

        # Print the actual HTML so we can identify IPC and CPC markers.
        print(section.prettify()[:12000])

        break
else:
    print("Classifications section not found.")
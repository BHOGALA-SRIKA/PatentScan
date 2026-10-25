
import requests
from bs4 import BeautifulSoup

url = "https://patents.google.com/patent/US7991714B2/en"

response = requests.get(
    url,
    headers={"User-Agent": "Mozilla/5.0"},
    timeout=30,
)
response.raise_for_status()

soup = BeautifulSoup(response.content, "html.parser")

# Print headings and their surrounding HTML.
for element in soup.find_all(
    ["h1", "h2", "h3", "h4", "section"]
):
    text = element.get_text(" ", strip=True)

    if "classification" in text.lower():
        print("\n--- CLASSIFICATION ELEMENT ---")
        print("Tag:", element.name)
        print("Text:", text[:1500])
        print("HTML:", str(element)[:3000])

# Inspect metadata related to classification.
print("\n--- CLASSIFICATION METADATA ---")

for tag in soup.find_all("meta"):
    scheme = tag.get("scheme", "")
    name = tag.get("name", "")
    content = tag.get("content", "")

    if (
        "ipc" in scheme.lower()
        or "cpc" in scheme.lower()
        or "class" in name.lower()
    ):
        print(
            f"scheme={scheme!r}, "
            f"name={name!r}, "
            f"content={content!r}"
        )

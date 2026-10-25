
import csv
import re
import time
from pathlib import Path
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

BASE_URL = "https://patents.google.com/xhr/query"

SEARCH_QUERY = "image recognition neural network"

MAX_RESULTS = 100

OUTPUT_FILE = Path("patents_dataset_enriched.csv")

session = requests.Session()

session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    )
})


# --------------------------------------------------
# HELPER: EXTRACT META TAG CONTENT
# --------------------------------------------------

def get_meta(soup, name):
    """Return content from a meta tag, if available."""

    element = soup.find("meta", attrs={"name": name})

    if element:
        return element.get("content", "").strip()

    return ""


# --------------------------------------------------
# HELPER: SEARCH GOOGLE PATENTS
# --------------------------------------------------

def search_patents(query, max_results=100):
    """Search Google Patents and return patent records."""

    params = {
        "url": f"q={query.replace(' ', '+')}",
        "exp": "",
    }

    search_url = (
        "https://patents.google.com/xhr/query?"
        + urlencode({
            "url": f"q={query}",
            "exp": "",
        })
    )

    print(f"Searching Google Patents for: {query}")

    response = session.get(search_url, timeout=30)
    response.raise_for_status()

    try:
        data = response.json()
    except ValueError:
        print("Could not parse Google Patents search response.")
        return []

    results = []

    # Google Patents search results are commonly returned
    # in a nested JSON structure.
    try:
        patent_results = data["results"]["cluster"][0]["result"]
    except (KeyError, IndexError, TypeError):
        print("Unexpected search response structure.")
        print("Inspect the search response before continuing.")
        return []

    for result in patent_results:
        if len(results) >= max_results:
            break

        patent = result.get("patent", {})

        publication_number = (
            patent.get("publication_number", "")
            or patent.get("publicationNumber", "")
        )

        if not publication_number:
            continue

        title = patent.get("title", "")
        abstract = patent.get("abstract", "")

        publication_date = patent.get("publication_date", "")
        priority_date = patent.get("priority_date", "")

        results.append({
            "publication_number": publication_number,
            "title": title,
            "abstract": abstract,
            "publication_date": publication_date,
            "priority_date": priority_date,
            "ipc_code": "",
            "cpc_code": "",
            "legal_status": "",
            "source_url": (
                "https://patents.google.com/patent/"
                f"{publication_number}/en"
            ),
        })

    return results


# --------------------------------------------------
# HELPER: EXTRACT IPC, CPC AND LEGAL STATUS
# --------------------------------------------------

def get_patent_details(url):
    """
    Extract abstract, IPC classifications, CPC classifications,
    and legal status from a Google Patents page.
    """

    try:
        response = session.get(url, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, "html.parser")

        abstract = (
            get_meta(soup, "DC.description")
            or get_meta(soup, "description")
        )

        ipc_codes = set()
        cpc_codes = set()

        # --------------------------------------------------
        # CLASSIFICATION EXTRACTION
        # --------------------------------------------------

        # Google Patents represents classification entries
        # using li elements with itemprop="classifications".
        for item in soup.select('li[itemprop="classifications"]'):

            # Obtain the code associated with this entry.
            code_element = item.find(
                "span",
                attrs={"itemprop": "Code"},
                recursive=False
            )

            if code_element is None:
                # Fallback for pages with a different nesting structure.
                code_element = item.select_one('[itemprop="Code"]')

            if code_element is None:
                continue

            code = code_element.get_text(" ", strip=True)

            if not code:
                continue

            # Google marks CPC entries with IsCPC=true.
            cpc_marker = item.select_one(
                '[itemprop="IsCPC"][content="true"]'
            )

            if cpc_marker:
                cpc_codes.add(code)
            

        # --------------------------------------------------
        # LEGAL STATUS EXTRACTION
        # --------------------------------------------------

        publication_number = url.rstrip("/").split("/")[-2]

        statuses = []

        for element in soup.select('[itemprop="ifiStatus"]'):
            value = element.get_text(" ", strip=True)

            if value:
                statuses.append(value)

        own_status = ""

        # Prefer the status associated with the current patent.
        for row in soup.select(
            '[itemprop="applications"], tr[itemprop="applications"]'
        ):
            publication = row.select_one(
                '[itemprop="representativePublication"]'
            )

            status = row.select_one('[itemprop="ifiStatus"]')

            if (
                publication
                and publication.get_text(" ", strip=True)
                == publication_number
                and status
            ):
                own_status = status.get_text(" ", strip=True)
                break

        legal_status = own_status or (
            statuses[0] if statuses else ""
        )

        return {
            "abstract": abstract,
            "ipc_code": "; ".join(sorted(ipc_codes)),
            "cpc_code": "; ".join(sorted(cpc_codes)),
            "legal_status": legal_status,
        }

    except Exception as error:
        print(f"Could not extract details from {url}: {error}")

        return {
            "abstract": "",
            "ipc_code": "",
            "cpc_code": "",
            "legal_status": "",
        }

    finally:
        time.sleep(2)


# --------------------------------------------------
# HELPER: NORMALIZE DATES
# --------------------------------------------------

def normalize_date(value):
    """Convert common Google Patents date formats to YYYY-MM-DD."""

    if not value:
        return ""

    value = str(value).strip()

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value

    if re.fullmatch(r"\d{8}", value):
        return (
            f"{value[:4]}-{value[4:6]}-{value[6:8]}"
        )

    return value


# --------------------------------------------------
# MAIN COLLECTION FUNCTION
# --------------------------------------------------

def collect_patents():
    """Collect patent search results and enrich their metadata."""

    patents = search_patents(
        SEARCH_QUERY,
        MAX_RESULTS
    )

    if not patents:
        print("No patents were collected.")
        return

    print(f"Collected {len(patents)} patent records.")

    for index, patent in enumerate(patents, start=1):

        print(
            f"[{index}/{len(patents)}] "
            f"Processing {patent['publication_number']}..."
        )

        details = get_patent_details(
            patent["source_url"]
        )

        # Preserve search-result values if the details page
        # does not provide an abstract.
        patent["abstract"] = (
            details["abstract"]
            or patent["abstract"]
        )

        patent["ipc_code"] = details["ipc_code"]
        patent["cpc_code"] = details["cpc_code"]
        patent["legal_status"] = details["legal_status"]

        patent["publication_date"] = normalize_date(
            patent["publication_date"]
        )

        patent["priority_date"] = normalize_date(
            patent["priority_date"]
        )

    # --------------------------------------------------
    # SAVE CSV
    # --------------------------------------------------

    fieldnames = [
        "publication_number",
        "title",
        "abstract",
        "publication_date",
        "priority_date",
        "ipc_code",
        "cpc_code",
        "legal_status",
        "source_url",
    ]

    output_path = OUTPUT_FILE.resolve()

    with open(
        output_path,
        "w",
        newline="",
        encoding="utf-8-sig"
    ) as csvfile:

        writer = csv.DictWriter(
            csvfile,
            fieldnames=fieldnames
        )

        writer.writeheader()
        writer.writerows(patents)

    print()
    print(f"Collected {len(patents)} patent records.")
    print(f"Saved to: {output_path}")

    # Report how many records have classification values.
    ipc_count = sum(
        bool(patent["ipc_code"])
        for patent in patents
    )

    cpc_count = sum(
        bool(patent["cpc_code"])
        for patent in patents
    )

    status_count = sum(
        bool(patent["legal_status"])
        for patent in patents
    )

    print("\n--- EXTRACTION SUMMARY ---")
    print(f"Patents collected: {len(patents)}")
    print(f"With IPC classifications: {ipc_count}")
    print(f"With CPC classifications: {cpc_count}")
    print(f"With legal status: {status_count}")
    print("\nReview the CSV before importing it.")


# --------------------------------------------------
# ENTRY POINT
# --------------------------------------------------

if __name__ == "__main__":
    collect_patents()


import csv
import json
import urllib.request
import urllib.error
from pathlib import Path

# CSV is in the main PatentScan project folder
PROJECT_DIR = Path(__file__).resolve().parent
CSV_FILE = PROJECT_DIR / "patents_dataset.csv"

# Next.js import API
API_URL = "http://localhost:3000/patents/imports"

REQUIRED_FIELDS = ["publication_number", "title", "abstract"]

def main():
    if not CSV_FILE.exists():
        print(f"ERROR: CSV file not found: {CSV_FILE}")
        return

    with CSV_FILE.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if not reader.fieldnames:
            print("ERROR: CSV has no header row.")
            return

        missing_columns = [
            field for field in REQUIRED_FIELDS
            if field not in reader.fieldnames
        ]
        if missing_columns:
            print("ERROR: Missing CSV columns:", missing_columns)
            print("Available columns:", reader.fieldnames)
            return

        patents = []
        for row_number, row in enumerate(reader, start=2):
            patent = {
                key: (row.get(key) or "").strip()
                for key in reader.fieldnames
            }

            # Required fields must not be empty.
            if any(not patent[field] for field in REQUIRED_FIELDS):
                print(f"Skipping row {row_number}: required field is empty.")
                continue

            # Convert empty optional values to JSON null.
            for key, value in patent.items():
                if value == "":
                    patent[key] = None

            patents.append(patent)

    print(f"Valid patents ready to import: {len(patents)}")

    if not patents:
        print("Nothing to import.")
        return

    if len(patents) > 100:
        print("ERROR: API accepts at most 100 records per request.")
        return

    payload = json.dumps({"patents": patents}).encode("utf-8")
    request = urllib.request.Request(
        API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            result = json.loads(response.read().decode("utf-8"))
            print("\nImport result:")
            print(json.dumps(result, indent=2))

    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        print(f"Import failed: HTTP {error.code}")
        print(details)

    except urllib.error.URLError as error:
        print("Could not connect to the Next.js application.")
        print("Check that npm run dev is running.")
        print(error)

if __name__ == "__main__":
    main()

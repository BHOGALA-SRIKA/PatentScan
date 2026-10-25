import os
import time
from pathlib import Path
from urllib.parse import urljoin

import psycopg2
import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient, UpdateOne
from dotenv import load_dotenv

# Load .env.local from the project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "patentscan")

if not DATABASE_URL or not MONGODB_URI:
    raise RuntimeError("Database connection settings are missing.")

session = requests.Session()
session.headers.update({
    "User-Agent": "PatentScanAcademicResearch/1.0"
})


def get_publication_numbers():
    """Read publication numbers from PostgreSQL."""
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT publication_number
                FROM patents
                WHERE publication_number IS NOT NULL
                ORDER BY publication_number
            """)
            return [row[0] for row in cursor.fetchall()]


def extract_citations(publication_number):
    """Extract patent citation links from a Google Patents page."""
    url = (
        "https://patents.google.com/patent/"
        f"{publication_number}/en"
    )

    response = session.get(url, timeout=25)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    relationships = {}

    # Citation entries commonly identify the cited patent in
    # a document-id element on the patent page.
    for item in soup.select(
        'tr[itemprop="backwardReferences"] '
        '[itemprop="publicationNumber"], '
        '[itemprop="backwardReferences"] '
        '[itemprop="publicationNumber"]'
    ):
        cited_number = item.get_text(" ", strip=True)

        if not cited_number:
            continue

        if cited_number == publication_number:
            continue

        relationships[cited_number] = {
            "source_publication_number": publication_number,
            "target_publication_number": cited_number,
            "relationship_type": "cites",
            "verification_source": "Google Patents",
            "verified": True,
            "source_url": url,
            "target_url": (
                "https://patents.google.com/patent/"
                f"{cited_number}/en"
            ),
        }

    return list(relationships.values())


def main():
    numbers = get_publication_numbers()
    print(f"Found {len(numbers)} patents in PostgreSQL.")

    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)

    try:
        client.admin.command("ping")
        collection = client[MONGODB_DATABASE][
            "patent_relationships"
        ]

        # Avoid duplicate source-target relationship pairs.
        collection.create_index(
            [
                ("source_publication_number", 1),
                ("target_publication_number", 1),
                ("relationship_type", 1),
            ],
            unique=True,
        )

        collected = 0
        failed = 0

        for index, publication_number in enumerate(numbers, start=1):
            print(
                f"[{index}/{len(numbers)}] "
                f"Checking {publication_number}"
            )

            try:
                relationships = extract_citations(publication_number)

                if relationships:
                    operations = [
                        UpdateOne(
                            {
                                "source_publication_number":
                                    relationship["source_publication_number"],
                                "target_publication_number":
                                    relationship["target_publication_number"],
                                "relationship_type":
                                    relationship["relationship_type"],
                            },
                            {"$set": relationship},
                            upsert=True,
                        )
                        for relationship in relationships
                    ]

                    result = collection.bulk_write(
                        operations, ordered=False
                    )
                    collected += (
                        result.upserted_count + result.modified_count
                    )

                print(f"  Found {len(relationships)} citations.")

            except requests.RequestException as error:
                failed += 1
                print(f"  Request failed: {error}")

            except Exception as error:
                failed += 1
                print(f"  Processing failed: {error}")

            # Be considerate of the source website.
            time.sleep(2)

        print("\n--- SUMMARY ---")
        print(f"Patents checked: {len(numbers)}")
        print(f"Relationship records inserted/updated: {collected}")
        print(f"Patents with processing errors: {failed}")
        print(
            "Total relationships in MongoDB:",
            collection.count_documents({}),
        )

    finally:
        client.close()


if __name__ == "__main__":
    main()
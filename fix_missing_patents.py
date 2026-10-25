
import os
import requests
import psycopg2
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL not found in .env.local")

HEADERS = {
    "User-Agent": "Mozilla/5.0 PatentScan/1.0"
}


def main():
    connection = psycopg2.connect(DATABASE_URL)

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT patent_id, publication_number
                FROM patents
                WHERE NULLIF(TRIM(cpc_code), '') IS NULL
                   OR NULLIF(TRIM(legal_status), '') IS NULL
                ORDER BY patent_id
            """)

            missing = cursor.fetchall()

        connection.commit()

        print(f"Patents needing attention: {len(missing)}")

        for patent_id, publication_number in missing:
            url = (
                "https://patents.google.com/patent/"
                f"{publication_number}/en"
            )

            try:
                response = requests.get(
                    url,
                    headers=HEADERS,
                    timeout=20
                )

                print(
                    f"{publication_number}: "
                    f"HTTP {response.status_code}"
                )

                if response.status_code == 200:
                    print("  Page exists; rerun update_cpc_codes.py.")
                elif response.status_code == 404:
                    print(
                        "  Publication number needs verification. "
                        "No database values changed."
                    )

            except requests.RequestException as error:
                print(f"  Request failed: {error}")

    finally:
        connection.close()


if __name__ == "__main__":
    main()


import os
import re
import time
import requests
import psycopg2

from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv(".env.local")
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL not found. Check your .env.local file."
    )

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

def fetch_ipc_codes(publication_number):
    url = (
        "https://patents.google.com/patent/"
        f"{publication_number}/en"
    )

    response = requests.get(
        url,
        headers=HEADERS,
        timeout=25
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    codes = []

    # Extract IPC classifications, excluding CPC entries.
    for item in soup.select('li[itemprop="classifications"]'):
        code_element = item.select_one('[itemprop="Code"]')

        if not code_element:
            continue

        code = code_element.get_text(" ", strip=True)
        is_cpc = item.select_one(
            'meta[itemprop="IsCPC"][content="true"]'
        )

        # IsCPC=true means this entry is CPC, not IPC.
        if is_cpc:
            continue

        code = re.sub(r"\s+", "", code)

        if code and code not in codes:
            codes.append(code)

    return ", ".join(codes) if codes else None


def main():
    connection = psycopg2.connect(DATABASE_URL)

    updated = 0
    missing = []
    failed = []

    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT patent_id, publication_number
                FROM patents
                ORDER BY patent_id
            """)
            patents = cursor.fetchall()

        connection.commit()
        total = len(patents)

        print(f"Found {total} patents.\n")

        for index, (patent_id, publication_number) in enumerate(
            patents, start=1
        ):
            try:
                ipc_code = fetch_ipc_codes(publication_number)

                if ipc_code:
                    with connection.cursor() as cursor:
                        cursor.execute("""
                            UPDATE patents
                            SET ipc_code = %s
                            WHERE patent_id = %s
                        """, (ipc_code, patent_id))

                    connection.commit()
                    updated += 1

                    print(
                        f"[{index}/{total}] {publication_number} "
                        f"| IPC FOUND: {ipc_code}"
                    )
                else:
                    missing.append(publication_number)

                    print(
                        f"[{index}/{total}] {publication_number} "
                        "| IPC NOT FOUND"
                    )

            except Exception as error:
                connection.rollback()
                failed.append((publication_number, str(error)))

                print(
                    f"[{index}/{total}] {publication_number} "
                    f"| ERROR: {error}"
                )

            time.sleep(0.3)

        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (
                        WHERE NULLIF(TRIM(ipc_code), '') IS NOT NULL
                    ) AS with_ipc
                FROM patents
            """)
            total_count, with_ipc = cursor.fetchone()

        connection.commit()

        print("\n========== IPC UPDATE SUMMARY ==========")
        print(f"Total patents: {total_count}")
        print(f"Patents updated this run: {updated}")
        print(f"Patents with IPC codes: {with_ipc}")
        print(f"Missing IPC codes: {len(missing)}")
        print(f"Failed requests: {len(failed)}")

        if missing:
            print("\nPatents without IPC codes:")
            for number in missing:
                print(f"  {number}")

        if failed:
            print("\nFailed patents:")
            for number, error in failed:
                print(f"  {number}: {error}")

    finally:
        connection.close()


if __name__ == "__main__":
    main()

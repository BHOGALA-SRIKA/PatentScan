import os
import re
import time
import requests
import psycopg2

from bs4 import BeautifulSoup
from dotenv import load_dotenv


# Load database configuration from .env
load_dotenv(".env.local")
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL not found. Check your .env.local file."
    )


HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    )
}

REQUEST_TIMEOUT = 20


def fetch_patent_data(publication_number):
    """
    Fetch CPC classifications and legal-status text
    from the Google Patents page.

    Returns:
        (cpc_code, legal_status)
    """

    publication_number = publication_number.strip()

    url = (
        "https://patents.google.com/patent/"
        f"{publication_number}/en"
    )

    response = requests.get(
        url,
        headers=HEADERS,
        timeout=REQUEST_TIMEOUT
    )

    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # -----------------------------------------
    # Extract CPC classifications
    # -----------------------------------------
    cpc_codes = []

    for item in soup.select(
        'li[itemprop="classifications"]'
    ):
        is_cpc = item.select_one(
            'meta[itemprop="IsCPC"][content="true"]'
        )

        if not is_cpc:
            continue

        code_element = item.select_one(
            '[itemprop="Code"]'
        )

        if not code_element:
            continue

        code = code_element.get_text(
            " ",
            strip=True
        )

        if code:
            # Remove whitespace inside the code.
            code = re.sub(r"\s+", "", code)

            if code not in cpc_codes:
                cpc_codes.append(code)

    # Store multiple CPC codes in the existing column.
    # Keep the field within a reasonable size.
    cpc_code = ", ".join(cpc_codes)

    # -----------------------------------------
    # Extract legal-status text
    # -----------------------------------------
    legal_status = None

    status_element = soup.select_one(
        '[itemprop="status"]'
    )

    if status_element:
        legal_status = status_element.get_text(
            " ",
            strip=True
        )

    # Fallback: search for a legal-status section.
    if not legal_status:
        for element in soup.select(
            '[itemprop="legalStatus"]'
        ):
            text = element.get_text(
                " ",
                strip=True
            )

            if text:
                legal_status = text
                break

    if legal_status:
        legal_status = re.sub(
            r"\s+",
            " ",
            legal_status
        ).strip()

        # PostgreSQL column was expanded to VARCHAR(200).
        legal_status = legal_status[:200]

    return cpc_code or None, legal_status or None


def main():
    connection = None

    cpc_updated = 0
    status_updated = 0
    cpc_missing = []
    status_missing = []
    failures = []

    try:
        connection = psycopg2.connect(DATABASE_URL)

        # Fetch the patent list first, then finish that transaction.
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT patent_id, publication_number
                FROM patents
                ORDER BY patent_id
                """
            )

            patents = cursor.fetchall()

        connection.commit()

        total = len(patents)

        print(f"\nFound {total} patents.")
        print("Starting CPC and legal-status updates...\n")

        for index, (patent_id, publication_number) in enumerate(
            patents,
            start=1
        ):
            try:
                cpc_code, legal_status = fetch_patent_data(
                    publication_number
                )

                updates = []
                values = []

                if cpc_code:
                    updates.append("cpc_code = %s")
                    values.append(cpc_code)
                else:
                    cpc_missing.append(publication_number)

                if legal_status:
                    updates.append("legal_status = %s")
                    values.append(legal_status)
                else:
                    status_missing.append(publication_number)

                if updates:
                    values.append(patent_id)

                    with connection.cursor() as cursor:
                        cursor.execute(
                            f"""
                            UPDATE patents
                            SET {", ".join(updates)}
                            WHERE patent_id = %s
                            """,
                            values
                        )

                    # Commit each patent independently.
                    connection.commit()

                    if cpc_code:
                        cpc_updated += 1

                    if legal_status:
                        status_updated += 1

                print(
                    f"[{index}/{total}] "
                    f"{publication_number} | "
                    f"CPC: "
                    f"{'FOUND' if cpc_code else 'MISSING'} | "
                    f"Status: "
                    f"{legal_status or 'MISSING'}"
                )

            except Exception as error:
                # Recover from a failed database transaction.
                connection.rollback()

                failures.append(
                    (publication_number, str(error))
                )

                print(
                    f"[{index}/{total}] "
                    f"{publication_number} | ERROR: {error}"
                )

            time.sleep(0.3)

        # -----------------------------------------
        # Final database verification
        # -----------------------------------------
        connection.commit()

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COUNT(*) AS total_patents,

                    COUNT(*) FILTER (
                        WHERE NULLIF(
                            TRIM(cpc_code),
                            ''
                        ) IS NOT NULL
                    ) AS with_cpc,

                    COUNT(*) FILTER (
                        WHERE NULLIF(
                            TRIM(legal_status),
                            ''
                        ) IS NOT NULL
                    ) AS with_legal_status

                FROM patents
                """
            )

            total_count, with_cpc, with_status = (
                cursor.fetchone()
            )

        connection.commit()

        print("\n" + "=" * 55)
        print("PATENT UPDATE SUMMARY")
        print("=" * 55)

        print(f"Total patents in database: {total_count}")
        print(f"Patents with CPC codes: {with_cpc}")
        print(f"Patents with legal status: {with_status}")

        print(f"\nCPC values updated this run: {cpc_updated}")
        print(
            "Legal-status values updated this run: "
            f"{status_updated}"
        )

        print(f"Patents without CPC data found: {len(cpc_missing)}")
        print(
            "Patents without legal-status data found: "
            f"{len(status_missing)}"
        )
        print(f"Failed requests or updates: {len(failures)}")

        if cpc_missing:
            print("\nPatents with missing CPC data:")
            for number in cpc_missing:
                print(f"  - {number}")

        if status_missing:
            print("\nPatents with missing legal status:")
            for number in status_missing:
                print(f"  - {number}")

        if failures:
            print("\nFailed patents:")
            for number, error in failures:
                print(f"  - {number}: {error}")

        print("\nFinished.")

    finally:
        if connection is not None:
            connection.close()


if __name__ == "__main__":
    main()
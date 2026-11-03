"""
PatentScan Google Patents collector.

Uses the existing Google Patents public search endpoint and individual patent
publication pages. It does not bypass CAPTCHA, access controls, 403, or 429
responses. If Google denies automated access, it stops and reports the issue.

Requirements:
    pip install -r requirements-data.txt

Configuration:
    Reads DATABASE_URL from the process environment or project .env.local.
    Never prints the connection string or credentials.

Run:
    python scripts/patent_collector.py --dry-run
    python scripts/patent_collector.py --target-per-domain 20
    python scripts/patent_collector.py --domains "Internet of Things and Embedded Systems"
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

import psycopg2
import requests
from bs4 import BeautifulSoup
from psycopg2.extras import RealDictCursor
from pymongo import MongoClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
SOURCE_NAME = "Google Patents"
DEFAULT_TARGET = 20
REQUEST_DELAY_SECONDS = 2.0
TIMEOUT_SECONDS = 30

DOMAIN_QUERIES: dict[str, list[str]] = {
    "Artificial Intelligence and Machine Learning": [
        "machine learning model training neural network",
        "deep learning image classification",
        "transformer attention neural network",
        "reinforcement learning policy optimization",
        "machine learning classification prediction",
    ],
    "Internet of Things and Embedded Systems": [
        "internet of things sensor network",
        "embedded system microcontroller architecture",
        "industrial internet of things monitoring",
        "wireless sensor node energy management",
        "embedded device real time control",
    ],
    "Healthcare and Biomedical Technology": [
        "medical diagnostic imaging technology",
        "biomedical sensor patient monitoring",
        "healthcare medical device technology",
        "wearable health monitoring system",
        "medical image analysis diagnostic system",
    ],
    "Communication and Networking": [
        "wireless communication network protocol",
        "5G cellular communication technology",
        "network routing packet switching",
        "wireless signal transmission technology",
        "network congestion control data transmission",
    ],
}

DOMAIN_TERMS: dict[str, tuple[str, ...]] = {
    "Artificial Intelligence and Machine Learning": (
        "machine learning", "neural network", "deep learning",
        "reinforcement learning", "classifier", "classification model",
        "training model", "transformer", "artificial intelligence",
    ),
    "Internet of Things and Embedded Systems": (
        "internet of things", "iot device", "sensor network",
        "embedded system", "microcontroller", "embedded device",
        "firmware", "sensor node", "industrial iot", "real time controller",
    ),
    "Healthcare and Biomedical Technology": (
        "medical device", "medical imaging", "biomedical",
        "patient monitoring", "diagnostic imaging", "healthcare",
        "clinical diagnosis", "prosthetic", "medical sensor", "drug delivery",
    ),
    "Communication and Networking": (
        "wireless communication", "5g", "cellular network",
        "network routing", "packet switching", "communication protocol",
        "signal transmission", "network congestion", "data transmission",
        "radio frequency",
    ),
}

NEW_DOMAINS = [
    "Internet of Things and Embedded Systems",
    "Healthcare and Biomedical Technology",
    "Communication and Networking",
]


@dataclass
class Patent:
    publication_number: str
    title: str
    abstract: str
    publication_date: str | None
    priority_date: str | None
    ipc_code: str | None
    cpc_code: str | None
    legal_status: str | None
    source_url: str
    domain: str


def load_database_url() -> str:
    """Read DATABASE_URL without printing it; .env.local is not modified."""
    value = os.environ.get("DATABASE_URL")
    if value:
        return value

    env_file = PROJECT_ROOT / ".env.local"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, raw = stripped.split("=", 1)
            if key.strip() == "DATABASE_URL":
                value = raw.strip().strip('"').strip("'")
                if value:
                    return value

    raise RuntimeError(
        "DATABASE_URL was not found in the process environment or .env.local. "
        "The collector will not use a hardcoded fallback."
    )


def load_mongodb_config() -> tuple[str, str]:
    """Read MongoDB settings from environment or .env.local without printing secrets."""
    mongo_uri = os.environ.get("MONGODB_URI")
    mongo_database = os.environ.get("MONGODB_DATABASE")
    env_file = PROJECT_ROOT / ".env.local"

    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, raw = stripped.split("=", 1)
            key = key.strip()
            value = raw.strip().strip('"').strip("'")
            if key == "MONGODB_URI" and not mongo_uri:
                mongo_uri = value
            elif key == "MONGODB_DATABASE" and not mongo_database:
                mongo_database = value

    if not mongo_uri:
        raise RuntimeError("MONGODB_URI was not found in environment or .env.local.")
    return mongo_uri, mongo_database or "patentscan"


def save_citations(collection, source_publication_number: str, citations: list[str]) -> int:
    """Insert Google Patents backward citations without overwriting existing records."""
    source_publication_number = normalize_publication_number(source_publication_number)
    source_url = f"https://patents.google.com/patent/{source_publication_number}/en"
    inserted = 0

    for raw_target in set(citations):
        target = normalize_publication_number(raw_target)
        if not target or target == source_publication_number:
            continue
        target_url = f"https://patents.google.com/patent/{target}/en"
        document = {
            "source_publication_number": source_publication_number,
            "target_publication_number": target,
            "relationship_type": "cites",
            "description": (
                f"{source_publication_number} cites {target}. "
                "Listed in the citations on Google Patents."
            ),
            "verified": True,
            "verification_source": "Google Patents",
            "source_url": source_url,
            "target_url": target_url,
        }
        result = collection.update_one(
            {
                "source_publication_number": source_publication_number,
                "target_publication_number": target,
                "relationship_type": "cites",
            },
            {"$setOnInsert": document},
            upsert=True,
        )
        if result.upserted_id is not None:
            inserted += 1
    return inserted


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        value = " ".join(str(v) for v in value)
    text = BeautifulSoup(str(value), "html.parser").get_text(" ", strip=True)
    return re.sub(r"\s+", " ", text).strip()


def normalize_publication_number(value: str) -> str:
    return re.sub(r"\s+", "", value or "").strip()


def parse_date(value: Any) -> str | None:
    if not value:
        return None
    match = re.search(r"\b(\d{4}-\d{2}-\d{2})\b", str(value))
    if match:
        return match.group(1)
    match = re.search(r"\b(19|20)\d{2}\b", str(value))
    return f"{match.group(0)}-01-01" if match else None


def classify_domain(title: str, abstract: str, preferred_domain: str) -> str:
    """Assign only when the patent text supports the search-domain candidate."""
    text = f"{title} {abstract}".lower()
    scores = {
        domain: sum(1 for term in terms if term in text)
        for domain, terms in DOMAIN_TERMS.items()
    }
    best_domain = max(scores, key=scores.get)
    best_score = scores[best_domain]

    # A query can guide classification, but does not override patent content.
    preferred_score = scores.get(preferred_domain, 0)
    if preferred_score >= 2 and preferred_score >= best_score:
        return preferred_domain
    if best_score >= 2:
        return best_domain
    return "Needs Review"


def _google_request(session: requests.Session, url: str) -> requests.Response:
    response = session.get(url, timeout=TIMEOUT_SECONDS)
    if response.status_code in (403, 429):
        raise RuntimeError(
            f"Google Patents returned HTTP {response.status_code}. "
            "Automated access may be restricted. The collector stopped; "
            "it will not bypass the restriction."
        )
    response.raise_for_status()
    return response


def search_google_patents(
    session: requests.Session, query: str, limit: int
) -> list[dict[str, Any]]:
    # This is the same public Google Patents query endpoint used by the
    # existing project collector. Do not add CAPTCHA or access-control bypasses.
    inner_query = urlencode({"q": query, "num": str(limit), "exp": ""})
    url = "https://patents.google.com/xhr/query?" + urlencode({"url": inner_query})
    response = _google_request(session, url)
    payload = response.json()
    clusters = payload.get("results", {}).get("cluster", [])
    results: list[dict[str, Any]] = []
    for cluster in clusters:
        results.extend(cluster.get("result", []) or [])
    return results



def extract_backward_citations(
    soup: BeautifulSoup,
    source_publication_number: str,
) -> list[str]:
    """Extract unique backward citations from a Google Patents page."""
    citations: set[str] = set()
    for prop in ("backwardReferences", "backwardReferencesOrig"):
        for node in soup.select(f'[itemprop="{prop}"] [itemprop="publicationNumber"]'):
            publication_number = normalize_publication_number(
                node.get("content") or node.get_text(" ", strip=True)
            )
            if publication_number and publication_number != source_publication_number:
                citations.add(publication_number)
    return sorted(citations)

def extract_details(
    session: requests.Session, publication_number: str
) -> tuple[str, str | None, str | None, str | None, str | None, str | None, list[str]]:
    url = f"https://patents.google.com/patent/{publication_number}/en"
    response = _google_request(session, url)
    soup = BeautifulSoup(response.text, "html.parser")

    abstract = ""
    for selector in (
        'meta[name="DC.description"]',
        'meta[name="description"]',
    ):
        node = soup.select_one(selector)
        if node and node.get("content"):
            abstract = clean_text(node.get("content"))
            if abstract:
                break
    if not abstract:
        node = soup.select_one('section[itemprop="abstract"]')
        if node:
            abstract = clean_text(node.get_text(" ", strip=True))

    ipc: set[str] = set()
    cpc: set[str] = set()
    for item in soup.select('li[itemprop="classifications"]'):
        code_node = item.select_one('[itemprop="Code"]')
        if not code_node:
            continue
        code = clean_text(code_node.get_text(" ", strip=True))
        if not code:
            continue
        if item.select_one('[itemprop="IsCPC"][content="true"]'):
            cpc.add(code)
        else:
            ipc.add(code)

    legal_nodes = soup.select('[itemprop="ifiStatus"]')
    legal_status = clean_text(" ".join(n.get_text(" ", strip=True) for n in legal_nodes))

    pub_date = None
    priority_date = None
    for node in soup.select('[itemprop="publicationDate"]'):
        pub_date = parse_date(node.get("content") or node.get_text())
        if pub_date:
            break
    for node in soup.select('[itemprop="priorityDate"]'):
        priority_date = parse_date(node.get("content") or node.get_text())
        if priority_date:
            break

    citations = extract_backward_citations(soup, publication_number)
    return (
        abstract,
        "; ".join(sorted(ipc)[:10]) or None,
        "; ".join(sorted(cpc)[:10]) or None,
        legal_status or None,
        pub_date,
        priority_date,
        citations,
    )


def verify_schema(cursor) -> None:
    cursor.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'patents'
        """
    )
    columns = {row[0] for row in cursor.fetchall()}
    required = {
        "publication_number", "title", "abstract", "publication_date",
        "priority_date", "ipc_code", "cpc_code", "legal_status",
        "source_url", "domain", "source_name", "source_identifier",
    }
    missing = sorted(required - columns)
    if missing:
        raise RuntimeError(
            "The patents table is missing required columns: "
            + ", ".join(missing)
            + ". Apply db/migrations/003_patent_provenance_domains.sql first."
        )


def fetch_existing(cursor) -> set[str]:
    cursor.execute("SELECT publication_number FROM patents")
    return {row[0] for row in cursor.fetchall()}


def save_patent(cursor, patent: Patent) -> int | None:
    cursor.execute(
        """
        INSERT INTO patents (
            publication_number, title, abstract, publication_date,
            priority_date, ipc_code, cpc_code, legal_status, source_url,
            domain, source_name, source_identifier
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (publication_number) DO NOTHING
        RETURNING patent_id
        """,
        (
            patent.publication_number, patent.title, patent.abstract,
            patent.publication_date, patent.priority_date, patent.ipc_code,
            patent.cpc_code, patent.legal_status, patent.source_url,
            patent.domain, SOURCE_NAME, patent.publication_number,
        ),
    )
    row = cursor.fetchone()
    return row[0] if row else None


def create_embedding_model():
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise RuntimeError(
            "sentence-transformers is missing. Install requirements-data.txt."
        ) from exc
    return SentenceTransformer(MODEL_NAME)


def save_embedding(cursor, patent_id: int, title: str, abstract: str, model) -> None:
    import numpy as np

    vector = model.encode(
        f"{title}. {abstract}",
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    if len(vector) != 384:
        raise RuntimeError(f"Expected 384 embedding dimensions, got {len(vector)}")
    vector_literal = "[" + ",".join(str(float(x)) for x in vector.tolist()) + "]"
    cursor.execute(
        """
        INSERT INTO patent_embeddings (patent_id, embedding, model_name, embedded_at)
        VALUES (%s, %s::vector, %s, NOW())
        ON CONFLICT (patent_id) DO NOTHING
        """,
        (patent_id, vector_literal, MODEL_NAME),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect authentic Google Patents records.")
    parser.add_argument("--target-per-domain", type=int, default=DEFAULT_TARGET)
    parser.add_argument("--domains", nargs="*", choices=list(DOMAIN_QUERIES))
    parser.add_argument("--dry-run", action="store_true", help="Search and parse, but do not write.")
    parser.add_argument("--no-embeddings", action="store_true", help="Import metadata only.")
    parser.add_argument("--delay", type=float, default=REQUEST_DELAY_SECONDS)
    args = parser.parse_args()

    if args.target_per_domain < 1 or args.delay < 1:
        parser.error("--target-per-domain must be positive and --delay must be at least 1 second.")

    selected_domains = args.domains or NEW_DOMAINS
    database_url = load_database_url()

    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    model = None
    mongo_client = None
    mongo_collection = None
    session = requests.Session()
    session.headers.update({
        "User-Agent": "PatentScan student research project contact: project-maintainer",
        "Accept-Language": "en-US,en;q=0.8",
    })

    stats = {
        domain: {
            "found": 0, "imported": 0, "duplicates": 0,
            "invalid": 0, "failed": 0, "embedded": 0,
            "citations_saved": 0, "citations_found": 0,
        }
        for domain in selected_domains
    }
    sample_records: dict[str, list[tuple[str, str]]] = {d: [] for d in selected_domains}

    try:
        if not args.dry_run:
            mongo_uri, mongo_database = load_mongodb_config()
            mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
            mongo_client.admin.command("ping")
            mongo_collection = mongo_client[mongo_database]["patent_relationships"]
            print("MongoDB connection successful.")

        with conn.cursor() as cursor:
            verify_schema(cursor)
            existing = fetch_existing(cursor)
            print(f"Existing patents: {len(existing)}")
            print("Database connection successful. Credentials are not displayed.")

        for domain in selected_domains:
            print(f"\n=== {domain}: target {args.target_per_domain} new records ===")
            for query in DOMAIN_QUERIES[domain]:
                progress = stats[domain]["found"] if args.dry_run else stats[domain]["imported"]
                if progress >= args.target_per_domain:
                    break
                print(f"Searching: {query}")
                try:
                    results = search_google_patents(
                        session, query, max(25, args.target_per_domain * 2)
                    )
                except Exception as exc:
                    stats[domain]["failed"] += 1
                    print(f"Search failed: {exc}")
                    if "HTTP 403" in str(exc) or "HTTP 429" in str(exc):
                        raise
                    time.sleep(args.delay)
                    continue
                time.sleep(args.delay)

                for item in results:
                    progress = stats[domain]["found"] if args.dry_run else stats[domain]["imported"]
                    if progress >= args.target_per_domain:
                        break
                    patent_info = item.get("patent", {}) or {}
                    pub = normalize_publication_number(
                        patent_info.get("publication_number")
                        or patent_info.get("publicationNumber")
                        or ""
                    )
                    if not pub:
                        stats[domain]["invalid"] += 1
                        continue
                    if pub in existing:
                        stats[domain]["duplicates"] += 1
                        continue

                    title = clean_text(patent_info.get("title", ""))
                    if len(title) < 5:
                        stats[domain]["invalid"] += 1
                        continue

                    try:
                        (
                            abstract, ipc, cpc, legal, page_pub_date,
                            page_priority, citations,
                        ) = extract_details(session, pub)
                        time.sleep(args.delay)
                    except Exception as exc:
                        stats[domain]["failed"] += 1
                        print(f"Page fetch failed for {pub}: {exc}")
                        if "HTTP 403" in str(exc) or "HTTP 429" in str(exc):
                            raise
                        continue

                    # A search-result snippet is not treated as a full abstract.
                    if len(abstract) < 30:
                        stats[domain]["invalid"] += 1
                        continue

                    assigned_domain = classify_domain(title, abstract, domain)
                    source_url = f"https://patents.google.com/patent/{pub}/en"
                    patent = Patent(
                        publication_number=pub,
                        title=title,
                        abstract=abstract,
                        publication_date=page_pub_date or parse_date(
                            patent_info.get("publication_date")
                        ),
                        priority_date=page_priority or parse_date(
                            patent_info.get("priority_date")
                        ),
                        ipc_code=ipc,
                        cpc_code=cpc,
                        legal_status=legal,
                        source_url=source_url,
                        domain=assigned_domain,
                    )

                    stats[domain]["found"] += 1
                    stats[domain]["citations_found"] += len(citations)
                    if args.dry_run:
                        existing.add(pub)
                        if len(sample_records[domain]) < 5:
                            sample_records[domain].append((pub, source_url))
                        continue

                    try:
                        embedded_this_record = False
                        with conn.cursor() as cursor:
                            patent_id = save_patent(cursor, patent)
                            if patent_id is None:
                                conn.rollback()
                                stats[domain]["duplicates"] += 1
                                existing.add(pub)
                                continue

                            if not args.no_embeddings:
                                if model is None:
                                    model = create_embedding_model()
                                save_embedding(cursor, patent_id, title, abstract, model)
                                embedded_this_record = True

                        conn.commit()
                        # Update success counters only after the transaction commits.
                        stats[domain]["imported"] += 1
                        if mongo_collection is not None:
                            try:
                                saved = save_citations(mongo_collection, pub, citations)
                                stats[domain]["citations_saved"] += saved
                                print(f"  Backward citations: {len(citations)} found, {saved} newly saved")
                            except Exception as mongo_error:
                                print(f"  MongoDB citation save failed for {pub}: {mongo_error}")
                        if embedded_this_record:
                            stats[domain]["embedded"] += 1
                        existing.add(pub)
                        if len(sample_records[domain]) < 5:
                            sample_records[domain].append((pub, source_url))
                        print(
                            f"Imported {pub} [{assigned_domain}] "
                            f"({stats[domain]['imported']}/{args.target_per_domain})"
                        )
                    except Exception as exc:
                        conn.rollback()
                        stats[domain]["failed"] += 1
                        print(f"Database/embedding failure for {pub}: {exc}")

        print("\n=== COLLECTION SUMMARY ===")
        for domain, values in stats.items():
            print(f"{domain}: {values}")
            for pub, url in sample_records[domain]:
                print(f"  {pub} {url}")

        if not args.dry_run:
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(
                    """
                    SELECT domain, COUNT(*) AS patent_count
                    FROM patents
                    GROUP BY domain
                    ORDER BY domain
                    """
                )
                print("\n=== VERIFIED DATABASE DOMAIN COUNTS ===")
                for row in cursor.fetchall():
                    print(f"{row['domain']}: {row['patent_count']}")

                cursor.execute("SELECT COUNT(*) AS total FROM patents")
                print("Total patents:", cursor.fetchone()["total"])
                cursor.execute("SELECT COUNT(*) AS total FROM patent_embeddings")
                print("Total embeddings:", cursor.fetchone()["total"])

        return 0
    except Exception as exc:
        conn.rollback()
        print(f"\nCollector stopped: {exc}", file=sys.stderr)
        return 1
    finally:
        session.close()
        if mongo_client is not None:
            mongo_client.close()
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

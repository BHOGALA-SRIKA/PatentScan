import os
import sys
import psycopg2
from sentence_transformers import SentenceTransformer

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing. Load it from .env.local first."
    )

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"

print("Loading semantic search model...", flush=True)
model = SentenceTransformer(MODEL_NAME)


def semantic_search(query, limit=5):
    query_embedding = model.encode(
        query,
        normalize_embeddings=True
    ).tolist()

    vector_string = "[" + ",".join(
        str(float(value)) for value in query_embedding
    ) + "]"

    connection = psycopg2.connect(DATABASE_URL)

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    p.publication_number,
                    p.title,
                    p.abstract,
                    1 - (pe.embedding <=> %s::vector) AS similarity
                FROM patents AS p
                JOIN patent_embeddings AS pe
                    ON p.patent_id = pe.patent_id
                ORDER BY pe.embedding <=> %s::vector
                LIMIT %s;
                """,
                (vector_string, vector_string, limit)
            )

            results = cursor.fetchall()

        return results

    finally:
        connection.close()


if __name__ == "__main__":
    query = " ".join(sys.argv[1:]).strip()

    if not query:
        query = input("Enter a patent search query: ").strip()

    if not query:
        print("Please enter a search query.")
        sys.exit(1)

    print(f"\nSemantic search results for: {query}\n")

    results = semantic_search(query)

    if not results:
        print("No patents found.")
    else:
        for number, title, abstract, similarity in results:
            print(f"Publication: {number}")
            print(f"Title: {title}")
            print(f"Similarity: {similarity:.4f}")
            print(f"Abstract: {abstract}")
            print("-" * 70)
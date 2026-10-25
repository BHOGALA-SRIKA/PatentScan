import os
import psycopg2
from sentence_transformers import SentenceTransformer

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL is missing. Set it in your terminal before running."
    )

# This model produces 384-dimensional embeddings.
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

connection = psycopg2.connect(DATABASE_URL)

try:
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT patent_id, title, abstract
            FROM patents
            ORDER BY patent_id
        """)

        patents = cursor.fetchall()

        if not patents:
            print("No patents found in the patents table.")
        else:
            for patent_id, title, abstract in patents:
                text = f"{title}. {abstract}"
                embedding = model.encode(
                    text,
                    normalize_embeddings=True
                ).tolist()

                vector_string = "[" + ",".join(
                    str(float(value)) for value in embedding
                ) + "]"

                cursor.execute(
                    """
                    INSERT INTO patent_embeddings
                        (patent_id, embedding, model_name)
                    VALUES (%s, %s::vector, %s)
                    ON CONFLICT (patent_id)
                    DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        model_name = EXCLUDED.model_name,
                        embedded_at = CURRENT_TIMESTAMP
                    """,
                    (
                        patent_id,
                        vector_string,
                        "sentence-transformers/all-MiniLM-L6-v2",
                    ),
                )

                print(f"Generated embedding: {title}")

    connection.commit()
    print(f"\nFinished processing {len(patents)} patents.")

except Exception:
    connection.rollback()
    raise

finally:
    connection.close()
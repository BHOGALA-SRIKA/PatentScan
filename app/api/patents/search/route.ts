
import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type SearchMode = "keyword" | "semantic" | "hybrid";

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("http://127.0.0.1:8001/embed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Embedding service returned ${response.status}`);
  }

  const data = (await response.json()) as {
    embedding: number[];
    dimensions: number;
  };

  if (
    data.dimensions !== 384 ||
    !Array.isArray(data.embedding) ||
    data.embedding.length !== 384
  ) {
    throw new Error("Embedding service returned an invalid vector.");
  }

  return data.embedding;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("q")?.trim() ?? "";

  const requestedMode = params.get("mode") ?? "keyword";
  const mode: SearchMode =
    requestedMode === "semantic" || requestedMode === "hybrid"
      ? requestedMode
      : "keyword";

  const parsedLimit = Number(params.get("limit") ?? 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.floor(parsedLimit), 1), 50)
    : 10;

  if (!query) {
    return NextResponse.json(
      { error: "Provide a search term using ?q=keyword" },
      { status: 400 }
    );
  }

  try {
    // Keyword search: PostgreSQL full-text search.
    if (mode === "keyword") {
      const result = await pool.query(
        `
        SELECT
          patent_id,
          publication_number,
          title,
          abstract,
          publication_date,
          ipc_code,
          cpc_code,
          source_url,
          ts_rank(
            to_tsvector(
              'english',
              coalesce(title, '') || ' ' || coalesce(abstract, '')
            ),
            plainto_tsquery('english', $1)
          ) AS relevance_score,
          NULL::double precision AS semantic_similarity
        FROM patents
        WHERE to_tsvector(
          'english',
          coalesce(title, '') || ' ' || coalesce(abstract, '')
        ) @@ plainto_tsquery('english', $1)
        ORDER BY relevance_score DESC, publication_date DESC NULLS LAST
        LIMIT $2
        `,
        [query, limit]
      );

      return NextResponse.json({
        query,
        mode,
        count: result.rows.length,
        results: result.rows,
      });
    }

    // Generate a query embedding for semantic and hybrid search.
    const embedding = await generateEmbedding(query);
    const vector = `[${embedding.join(",")}]`;

    // Semantic search: rank patents by vector similarity.
    if (mode === "semantic") {
      const result = await pool.query(
        `
        SELECT
          p.patent_id,
          p.publication_number,
          p.title,
          p.abstract,
          p.publication_date,
          p.ipc_code,
          p.cpc_code,
          p.source_url,
          NULL::double precision AS relevance_score,
          1 - (pe.embedding <=> $1::vector) AS semantic_similarity
        FROM patents p
        JOIN patent_embeddings pe ON pe.patent_id = p.patent_id
        ORDER BY pe.embedding <=> $1::vector
        LIMIT $2
        `,
        [vector, limit]
      );

      return NextResponse.json({
        query,
        mode,
        count: result.rows.length,
        results: result.rows,
      });
    }

    // Hybrid search: combine normalized keyword and semantic scores.
    const result = await pool.query(
      `
      WITH keyword_scores AS (
        SELECT
          patent_id,
          ts_rank(
            to_tsvector(
              'english',
              coalesce(title, '') || ' ' || coalesce(abstract, '')
            ),
            plainto_tsquery('english', $1)
          ) AS keyword_score
        FROM patents
        WHERE to_tsvector(
          'english',
          coalesce(title, '') || ' ' || coalesce(abstract, '')
        ) @@ plainto_tsquery('english', $1)
      ),
      vector_scores AS (
        SELECT
          pe.patent_id,
          1 - (pe.embedding <=> $2::vector) AS semantic_similarity
        FROM patent_embeddings pe
      ),
      combined AS (
        SELECT
          p.patent_id,
          p.publication_number,
          p.title,
          p.abstract,
          p.publication_date,
          p.ipc_code,
          p.cpc_code,
          p.source_url,
          COALESCE(k.keyword_score, 0)::double precision AS relevance_score,
          v.semantic_similarity,
          (
            0.5 * CASE
              WHEN MAX(COALESCE(k.keyword_score, 0)) OVER () > 0
              THEN COALESCE(k.keyword_score, 0) /
                   MAX(COALESCE(k.keyword_score, 0)) OVER ()
              ELSE 0
            END
            +
            0.5 * COALESCE(v.semantic_similarity, 0)
          )::double precision AS hybrid_score
        FROM patents p
        LEFT JOIN keyword_scores k ON k.patent_id = p.patent_id
        LEFT JOIN vector_scores v ON v.patent_id = p.patent_id
      )
      SELECT *
      FROM combined
      ORDER BY hybrid_score DESC, publication_date DESC NULLS LAST
      LIMIT $3
      `,
      [query, vector, limit]
    );

    return NextResponse.json({
      query,
      mode,
      count: result.rows.length,
      results: result.rows,
    });
  } catch (error) {
    console.error("Patent search error:", error);

    return NextResponse.json(
      {
        error:
          "Patent search failed. Check that PostgreSQL and the embedding service are running.",
      },
      { status: 500 }
    );
  }
}

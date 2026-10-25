import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  try {
    const [
      totalResult,
      classificationResult,
      recentResult,
      statusResult,
    ] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total_patents
        FROM patents
      `),

      pool.query(`
        SELECT
          COALESCE(ipc_code, 'Unclassified') AS classification,
          COUNT(*)::int AS patent_count
        FROM patents
        GROUP BY COALESCE(ipc_code, 'Unclassified')
        ORDER BY patent_count DESC, classification
      `),

      pool.query(`
        SELECT
          publication_number,
          title,
          publication_date
        FROM patents
        ORDER BY publication_date DESC NULLS LAST, patent_id DESC
        LIMIT 5
      `),

      pool.query(`
        SELECT
          COALESCE(legal_status, 'Unknown') AS legal_status,
          COUNT(*)::int AS patent_count
        FROM patents
        GROUP BY COALESCE(legal_status, 'Unknown')
        ORDER BY patent_count DESC, legal_status
      `),
    ]);

    return NextResponse.json({
      total_patents: totalResult.rows[0].total_patents,
      patents_by_classification: classificationResult.rows,
      recent_patents: recentResult.rows,
      patents_by_legal_status: statusResult.rows,
    });
  } catch (error) {
    console.error("Patent reports error:", error);

    return NextResponse.json(
      { error: "Unable to generate patent reports." },
      { status: 500 }
    );
  }
}
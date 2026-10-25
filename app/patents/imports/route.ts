import { NextResponse } from "next/server";
import { Pool } from "pg";


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type PatentInput = {
  publication_number: string;
  title: string;
  abstract: string;
  publication_date?: string | null;
  priority_date?: string | null;
  ipc_code?: string | null;
  cpc_code?: string | null;
  legal_status?: string | null;
  source_url?: string | null;
};

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const patents: PatentInput[] = body.patents;

    if (!Array.isArray(patents) || patents.length === 0) {
      return NextResponse.json(
        { error: "Provide a non-empty patents array" },
        { status: 400 }
      );
    }

    if (patents.length > 100) {
      return NextResponse.json(
        { error: "Import a maximum of 100 records per request" },
        { status: 400 }
      );
    }

    for (const patent of patents) {
      if (
        !patent.publication_number?.trim() ||
        !patent.title?.trim() ||
        !patent.abstract?.trim()
      ) {
        return NextResponse.json(
          {
            error:
              "Every record must have publication_number, title, and abstract",
          },
          { status: 400 }
        );
      }
    }

    const client = await pool.connect();
    let inserted = 0;
    let skipped = 0;

    try {
      await client.query("BEGIN");

      for (const patent of patents) {
        const result = await client.query(
          `INSERT INTO patents (
             publication_number,
             title,
             abstract,
             publication_date,
             priority_date,
             ipc_code,
             cpc_code,
             legal_status,
             source_url
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (publication_number) DO NOTHING
           RETURNING patent_id`,
          [
            patent.publication_number.trim(),
            patent.title.trim(),
            patent.abstract.trim(),
            patent.publication_date || null,
            patent.priority_date || null,
            patent.ipc_code || null,
            patent.cpc_code || null,
            patent.legal_status || null,
            patent.source_url || null,
          ]
        );

        if (result.rowCount && result.rowCount > 0) {
          inserted++;
        } else {
          skipped++;
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS total_patents FROM patents"
    );

    return NextResponse.json({
      message: "Patent import completed",
      inserted,
      skipped_duplicates: skipped,
      total_patents: countResult.rows[0].total_patents,
    });
  } catch (error) {
    console.error("Patent import error:", error);

    return NextResponse.json(
      { error: "Patent import failed. Check the server terminal." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total_patents
      FROM patents
    `);

    return NextResponse.json({
      message: "Patent database status",
      total_patents: result.rows[0].total_patents,
    });
  } catch (error) {
    console.error("Patent database error:", error);

    return NextResponse.json(
      { error: "Unable to query the patent database" },
      { status: 500 }
    );
  }
}
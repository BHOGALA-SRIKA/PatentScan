import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { getAuthUser } from "@/lib/authMiddleware";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 50);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 100)
      : 50;

    const result = await pool.query(
      `SELECT search_id, query_text, search_type, results_count, duration_ms,
              created_at, domain, investigation_id
       FROM search_logs
       WHERE user_id = $1
       ORDER BY created_at DESC, search_id DESC
       LIMIT $2`,
      [authUser.user_id, limit]
    );

    return NextResponse.json({ history: result.rows, count: result.rows.length });
  } catch (error) {
    console.error("Search history API error:", error);
    return NextResponse.json({ error: "Unable to load search history." }, { status: 500 });
  }
}

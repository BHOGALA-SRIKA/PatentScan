
import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authMiddleware";
import { pool } from "@/lib/postgres";

export async function GET(request: NextRequest) {
  try {
    const authUser = getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    if (authUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const requestedPeriod = request.nextUrl.searchParams.get("period");
    const period = ["1y", "3y", "5y", "all"].includes(
      requestedPeriod || ""
    )
      ? requestedPeriod!
      : "all";

    const years =
      period === "1y" ? 1 :
      period === "3y" ? 3 :
      period === "5y" ? 5 : null;

    const [
      totals,
      classifications,
      legalStatuses,
      publicationTrend,
      recentPatents,
      dataQuality,
      userTotals,
      usersByRole,
      userRegistrationTrend,
      searchTotals,
      searchTrend,
      searchTypes,
      investigationTotals,
      investigationStatuses,
    ] = await Promise.all([

      // Patent totals
      pool.query(`
        SELECT
          COUNT(*)::int AS total_patents,
          COUNT(*) FILTER (
            WHERE NULLIF(TRIM(ipc_code), '') IS NOT NULL
          )::int AS ipc_records,
          COUNT(*) FILTER (
            WHERE NULLIF(TRIM(cpc_code), '') IS NOT NULL
          )::int AS cpc_records,
          COUNT(*) FILTER (
            WHERE NULLIF(TRIM(ipc_code), '') IS NOT NULL
               OR NULLIF(TRIM(cpc_code), '') IS NOT NULL
          )::int AS classified_patents
        FROM patents
      `),

      // Top technology subclasses
      pool.query(`
        WITH extracted_codes AS (
          SELECT
            p.patent_id,
            UPPER(
              SUBSTRING(TRIM(code) FROM '^([A-H][0-9]{2}[A-Z])')
            ) AS subclass
          FROM patents p
          CROSS JOIN LATERAL regexp_split_to_table(
            CONCAT_WS(
              ',',
              NULLIF(p.ipc_code, ''),
              NULLIF(p.cpc_code, '')
            ),
            '[,;]+'
          ) AS code
        )
        SELECT
          subclass AS classification,
          COUNT(DISTINCT patent_id)::int AS patent_count
        FROM extracted_codes
        WHERE subclass IS NOT NULL
        GROUP BY subclass
        ORDER BY patent_count DESC
        LIMIT 10
      `),

      // One recognised status per patent
      pool.query(`
        WITH extracted_status AS (
          SELECT
            p.patent_id,
            COALESCE(
              INITCAP(LOWER(
                (REGEXP_MATCH(
                  COALESCE(p.legal_status, ''),
                  '(Expired[[:space:]]*-[[:space:]]*Fee[[:space:]]*Related|Expired[[:space:]]*-[[:space:]]*Lifetime|Active|Pending|Abandoned|Withdrawn|Ceased|Granted)',
                  'i'
                ))[1]
              )),
              'Unknown'
            ) AS legal_status
          FROM patents p
        )
        SELECT
          legal_status,
          COUNT(DISTINCT patent_id)::int AS patent_count
        FROM extracted_status
        GROUP BY legal_status
        ORDER BY patent_count DESC
      `),

      // Publication trend
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', publication_date), 'YYYY-MM') AS month,
          COUNT(*)::int AS patent_count
        FROM patents
        WHERE publication_date IS NOT NULL
          AND (
            $1::int IS NULL
            OR publication_date >=
               CURRENT_DATE - MAKE_INTERVAL(years => $1::int)
          )
        GROUP BY DATE_TRUNC('month', publication_date)
        ORDER BY DATE_TRUNC('month', publication_date)
      `, [years]),

      // Recent patents
      pool.query(`
        SELECT publication_number, title, publication_date
        FROM patents
        ORDER BY publication_date DESC NULLS LAST
        LIMIT 10
      `),

      // Patent metadata quality
      pool.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE NULLIF(TRIM(ipc_code), '') IS NULL
          )::int AS missing_ipc,
          COUNT(*) FILTER (
            WHERE NULLIF(TRIM(cpc_code), '') IS NULL
          )::int AS missing_cpc,
          COUNT(*) FILTER (
            WHERE NULLIF(TRIM(abstract), '') IS NULL
          )::int AS missing_abstract,
          COUNT(*) FILTER (
            WHERE publication_date IS NULL
          )::int AS missing_publication_date
        FROM patents
      `),

      // User totals (no personal information returned)
      pool.query(`
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (
            WHERE UPPER(role) <> 'ADMIN'
          )::int AS regular_users,
          COUNT(*) FILTER (
            WHERE UPPER(role) = 'ADMIN'
          )::int AS admin_users
        FROM app_users
      `),

      // Users by role
      pool.query(`
        SELECT
          UPPER(COALESCE(NULLIF(TRIM(role), ''), 'UNKNOWN')) AS role,
          COUNT(*)::int AS user_count
        FROM app_users
        GROUP BY 1
        ORDER BY user_count DESC
      `),

      // Monthly registrations
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS user_count
        FROM app_users
        WHERE created_at IS NOT NULL
          AND (
            $1::int IS NULL
            OR created_at >=
               CURRENT_DATE - MAKE_INTERVAL(years => $1::int)
          )
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `, [years]),

      // Search totals
      pool.query(`
        SELECT
          COUNT(*)::int AS total_searches,
          COUNT(DISTINCT user_id) FILTER (
            WHERE user_id IS NOT NULL
          )::int AS users_who_searched,
          COALESCE(ROUND(AVG(duration_ms))::int, 0) AS average_duration_ms,
          COALESCE(SUM(results_count), 0)::bigint AS total_results
        FROM search_logs
        WHERE (
          $1::int IS NULL
          OR created_at >=
             CURRENT_DATE - MAKE_INTERVAL(years => $1::int)
        )
      `, [years]),

      // Monthly searches
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS search_count
        FROM search_logs
        WHERE created_at IS NOT NULL
          AND (
            $1::int IS NULL
            OR created_at >=
               CURRENT_DATE - MAKE_INTERVAL(years => $1::int)
          )
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `, [years]),

      // Search types
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(search_type), ''), 'Unknown') AS search_type,
          COUNT(*)::int AS search_count
        FROM search_logs
        WHERE (
          $1::int IS NULL
          OR created_at >=
             CURRENT_DATE - MAKE_INTERVAL(years => $1::int)
        )
        GROUP BY 1
        ORDER BY search_count DESC
      `, [years]),

      // Investigation totals
      pool.query(`
        SELECT
          COUNT(*)::int AS total_investigations,
          COUNT(DISTINCT user_id)::int AS users_with_investigations
        FROM investigations
        WHERE (
          $1::int IS NULL
          OR created_at >=
             CURRENT_DATE - MAKE_INTERVAL(years => $1::int)
        )
      `, [years]),

      // Investigation statuses
      pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(status), ''), 'Unknown') AS status,
          COUNT(*)::int AS investigation_count
        FROM investigations
        WHERE (
          $1::int IS NULL
          OR created_at >=
             CURRENT_DATE - MAKE_INTERVAL(years => $1::int)
        )
        GROUP BY 1
        ORDER BY investigation_count DESC
      `, [years]),
    ]);

    const embeddings = await pool.query(`
      SELECT COUNT(DISTINCT patent_id)::int AS total_embeddings
      FROM patent_embeddings
    `);

    return NextResponse.json({
      period,

      total_patents: totals.rows[0].total_patents,
      classified_patents: totals.rows[0].classified_patents,
      ipc_records: totals.rows[0].ipc_records,
      cpc_records: totals.rows[0].cpc_records,
      total_embeddings: embeddings.rows[0].total_embeddings,

      patents_by_classification: classifications.rows,
      patents_by_legal_status: legalStatuses.rows,
      publication_trend: publicationTrend.rows,
      recent_patents: recentPatents.rows,
      data_quality: dataQuality.rows[0],

      // User analytics
      user_analytics: {
        ...userTotals.rows[0],
        users_by_role: usersByRole.rows,
        registration_trend: userRegistrationTrend.rows,
      },

      // Aggregated search activity; no search queries exposed
      search_analytics: {
        ...searchTotals.rows[0],
        monthly_trend: searchTrend.rows,
        search_types: searchTypes.rows,
      },

      // Aggregated investigation activity; no descriptions exposed
      investigation_analytics: {
        ...investigationTotals.rows[0],
        statuses: investigationStatuses.rows,
      },
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });

  } catch (error) {
    console.error("Admin reports API error:", error);

    return NextResponse.json(
      { error: "Unable to generate database analytics. Check server logs." },
      { status: 500 }
    );
  }
}

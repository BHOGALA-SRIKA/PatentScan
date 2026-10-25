import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";

export async function POST(request: Request) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const userId = Number(body.user_id);
    const title = String(body.title || "").trim();
    const description = String(body.invention_description || "").trim();

    const claims = body.claim_elements;

    if (!Number.isInteger(userId) || userId <= 0) {
      return NextResponse.json(
        { success: false, error: "A valid user_id is required." },
        { status: 400 }
      );
    }

    if (!title || !description) {
      return NextResponse.json(
        {
          success: false,
          error: "Investigation title and invention description are required.",
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(claims) ||
      claims.length === 0 ||
      claims.some(
        (claim: unknown) =>
          typeof claim !== "string" || !claim.trim()
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Provide at least one non-empty claim element.",
        },
        { status: 400 }
      );
    }

    if (claims.length > 100) {
      return NextResponse.json(
        { success: false, error: "Maximum 100 claim elements allowed." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const investigationResult = await client.query(
      `INSERT INTO investigations
        (user_id, title, invention_description)
       VALUES ($1, $2, $3)
       RETURNING investigation_id, title, status, created_at`,
      [userId, title, description]
    );

    const investigation = investigationResult.rows[0];

    const savedClaims = [];

    for (let i = 0; i < claims.length; i++) {
      const result = await client.query(
        `INSERT INTO claim_elements
          (investigation_id, element_text, element_order, importance)
         VALUES ($1, $2, $3, $4)
         RETURNING element_id, element_text, element_order, importance`,
        [investigation.investigation_id, claims[i].trim(), i + 1, "MEDIUM"]
      );

      savedClaims.push(result.rows[0]);
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        success: true,
        message: "Investigation and claim elements saved successfully.",
        investigation,
        claim_elements: savedClaims,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    await client.query("ROLLBACK");

    console.error("Claim analysis save error:", error);

    const pgError = error as { code?: string };

    if (pgError.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          error:
            "The supplied user_id does not exist in app_users. A valid user account is required.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to save claim analysis." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const investigationId = Number(
      searchParams.get("investigation_id")
    );

    if (!Number.isInteger(investigationId) || investigationId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid investigation_id query parameter is required.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT
          i.investigation_id,
          i.title,
          i.invention_description,
          i.status,
          i.created_at,
          ce.element_id,
          ce.element_text,
          ce.element_order,
          ce.importance
       FROM investigations i
       LEFT JOIN claim_elements ce
         ON ce.investigation_id = i.investigation_id
       WHERE i.investigation_id = $1
       ORDER BY ce.element_order`,
      [investigationId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Investigation not found." },
        { status: 404 }
      );
    }

    const investigation = {
      investigation_id: result.rows[0].investigation_id,
      title: result.rows[0].title,
      invention_description: result.rows[0].invention_description,
      status: result.rows[0].status,
      created_at: result.rows[0].created_at,
      claim_elements: result.rows
        .filter((row) => row.element_id !== null)
        .map((row) => ({
          element_id: row.element_id,
          element_text: row.element_text,
          element_order: row.element_order,
          importance: row.importance,
        })),
    };

    return NextResponse.json({
      success: true,
      investigation,
    });
  } catch (error) {
    console.error("Fetch claim analysis error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to retrieve claim analysis." },
      { status: 500 }
    );
  }
}
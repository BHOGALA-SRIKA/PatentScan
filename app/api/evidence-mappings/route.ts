import { NextResponse, NextRequest } from "next/server";
import { pool } from "@/lib/postgres";

const VALID_EVIDENCE_LEVELS = ["EXPLICIT", "PARTIAL", "NONE"];

export async function POST(request: NextRequest) {
  try {
    const { getAuthUser } = await import('@/lib/authMiddleware');
    const authUser = getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
    }
    const body = await request.json();
    const elementId = Number(body.element_id);
    const patentId = Number(body.patent_id);
    const evidenceLevel = String(body.evidence_level || "").toUpperCase();
    const evidenceNote =
      typeof body.evidence_note === "string"
        ? body.evidence_note.trim()
        : null;

    if (
      !Number.isInteger(elementId) ||
      elementId <= 0 ||
      !Number.isInteger(patentId) ||
      patentId <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid element_id and patent_id are required.",
        },
        { status: 400 }
      );
    }
    // Ownership check: ensure claim element belongs to an investigation owned by the authenticated user
    const ownershipCheck = await pool.query(
      `SELECT i.user_id FROM claim_elements ce JOIN investigations i ON ce.investigation_id = i.investigation_id WHERE ce.element_id = $1`,
      [elementId]
    );
    if (ownershipCheck.rowCount === 0 || ownershipCheck.rows[0].user_id !== authUser.user_id) {
      return NextResponse.json({ success: false, error: 'Unauthorized access to claim element.' }, { status: 403 });
    }

    if (!VALID_EVIDENCE_LEVELS.includes(evidenceLevel)) {
      return NextResponse.json(
        {
          success: false,
          error: "Evidence level must be EXPLICIT, PARTIAL, or NONE.",
        },
        { status: 400 }
      );
    }
    const result = await pool.query(
      `INSERT INTO evidence_mappings
         (element_id, patent_id, evidence_level, evidence_note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (element_id, patent_id)
       DO UPDATE SET
         evidence_level = EXCLUDED.evidence_level,
         evidence_note = EXCLUDED.evidence_note,
         created_at = CURRENT_TIMESTAMP
       RETURNING mapping_id, element_id, patent_id,
                 evidence_level, evidence_note, created_at`,
      [elementId, patentId, evidenceLevel, evidenceNote]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Evidence mapping saved successfully.",
        mapping: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Save evidence mapping error:", error);

    const pgError = error as { code?: string };

    if (pgError.code === "23503") {
      return NextResponse.json(
        {
          success: false,
          error: "The claim element or patent ID does not exist.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Unable to save evidence mapping." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { getAuthUser } = await import('@/lib/authMiddleware');
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const elementId = Number(searchParams.get("element_id"));

    if (!Number.isInteger(elementId) || elementId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid element_id query parameter is required.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT
          em.mapping_id,
          em.element_id,
          ce.element_text,
          em.patent_id,
          p.publication_number,
          p.title AS patent_title,
          em.evidence_level,
          em.evidence_note,
          em.created_at
       FROM evidence_mappings em
       JOIN claim_elements ce ON ce.element_id = em.element_id
       JOIN patents p ON p.patent_id = em.patent_id
       WHERE em.element_id = $1
         AND EXISTS (
           SELECT 1
           FROM investigations i
           WHERE i.investigation_id = ce.investigation_id
             AND i.user_id = $2
         )
       ORDER BY em.created_at DESC`,
      [elementId, authUser.user_id]
    );

    return NextResponse.json({
      success: true,
      count: result.rows.length,
      mappings: result.rows,
    });
  } catch (error) {
    console.error("Fetch evidence mappings error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to retrieve evidence mappings." },
      { status: 500 }
    );
  }
}

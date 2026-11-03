import { NextResponse, NextRequest } from "next/server";
import { getMongoDatabase } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  // Authenticate user
  const { getAuthUser } = await import('@/lib/authMiddleware');
  const authUser = getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 });
  }
  try {
    const body = await request.json();

    const investigation_name = String(
      body.investigation_name || ""
    ).trim();

    const technology_area = String(
      body.technology_area || ""
    ).trim();

    const search_method = String(
      body.search_method || "Hybrid Search"
    ).trim();

    if (!investigation_name || !technology_area) {
      return NextResponse.json(
        {
          success: false,
          error: "Investigation name and technology area are required.",
        },
        { status: 400 }
      );
    }

    const db = await getMongoDatabase();

    const investigation = {
      investigation_name,
      technology_area,
      search_method,
      status: "saved",
      created_at: new Date(),
      user_id: authUser.user_id,
    };

    const result = await db
      .collection("investigation_metadata")
      .insertOne(investigation);

    return NextResponse.json(
      {
        success: true,
        message: "Investigation saved successfully.",
        investigation: {
          ...investigation,
          _id: result.insertedId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Save investigation error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to save the investigation.",
      },
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
    const db = await getMongoDatabase();

    const investigations = await db
      .collection("investigation_metadata")
      .find({ user_id: authUser.user_id })
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      count: investigations.length,
      investigations,
    });
  } catch (error) {
    console.error("Fetch investigations error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve investigations.",
      },
      { status: 500 }
    );
  }
}
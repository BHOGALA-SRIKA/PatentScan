import { NextResponse } from "next/server";
import { getMongoDatabase } from "@/lib/mongodb";

export async function POST(request: Request) {
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

export async function GET() {
  try {
    const db = await getMongoDatabase();

    const investigations = await db
      .collection("investigation_metadata")
      .find({})
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

import { NextResponse } from "next/server";
import { getMongoDatabase } from "@/lib/mongodb";

export async function GET(request: Request) {
  try {
    const db = await getMongoDatabase();
    const { searchParams } = new URL(request.url);

    const publicationNumber = searchParams.get("publication_number");

    // If a patent number is provided, find its relationships.
    // Otherwise, return all relationships.
    const filter = publicationNumber
      ? {
          $or: [
            { source_publication_number: publicationNumber },
            { target_publication_number: publicationNumber },
          ],
        }
      : {};

    const relationships = await db
      .collection("patent_relationships")
      .find(filter, { projection: { _id: 0 } })
      .toArray();

    return NextResponse.json({
      success: true,
      count: relationships.length,
      relationships,
    });
  } catch (error) {
    console.error("MongoDB relationship API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve patent relationships from MongoDB.",
      },
      { status: 500 }
    );
  }
}

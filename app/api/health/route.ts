import { NextResponse } from "next/server";
import { pool } from "@/lib/postgres";
import { getMongoDatabase } from "@/lib/mongodb";
export async function GET() {
  const result = {
    application: "running",
    postgresql: "not checked",
    mongodb: "not checked",
  };

  try {
    await pool.query("SELECT 1");
    result.postgresql = "connected";
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
    result.postgresql = "connection failed";
  }

  try {
    const db = await getMongoDatabase();
    await db.command({ ping: 1 });
    result.mongodb = "connected";
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    result.mongodb = "connection failed";
  }

  const success =
    result.postgresql === "connected" &&
    result.mongodb === "connected";

  return NextResponse.json(result, {
    status: success ? 200 : 503,
  });
}
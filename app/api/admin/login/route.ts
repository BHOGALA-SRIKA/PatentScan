
import { NextResponse } from "next/server";
import { verifyCredentials, signJwt } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password required." },
        { status: 400 }
      );
    }

    const user = await verifyCredentials(email, password);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials." },
        { status: 401 }
      );
    }

    if (user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Insufficient privileges." },
        { status: 403 }
      );
    }

    const token = signJwt({
      user_id: user.user_id,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      role: user.role,
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 2,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to process admin login." },
      { status: 500 }
    );
  }
}

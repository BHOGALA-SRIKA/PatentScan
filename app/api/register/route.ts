import { NextResponse } from 'next/server';
import { pool } from '@/lib/postgres';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { full_name, email, password } = await request.json();

    if (!full_name?.trim() || !email?.trim() || !password) {
      return NextResponse.json(
        { success: false, error: 'All fields are required.' },
        { status: 400 }
      );
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must contain at least 8 characters.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO app_users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'USER')
       ON CONFLICT (email) DO NOTHING
       RETURNING user_id`,
      [full_name.trim(), normalizedEmail, passwordHash]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: true, message: 'Registration successful. Please log in.' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}

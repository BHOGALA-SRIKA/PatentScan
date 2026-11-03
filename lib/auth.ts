import { pool } from '@/lib/postgres';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

export interface AuthUser {
  user_id: number;
  email: string;
  role: string;
}

export async function verifyCredentials(email: string, password: string): Promise<AuthUser | null> {
  const result = await pool.query(
    'SELECT user_id, email, password_hash, role FROM app_users WHERE email = $1',
    [email]
  );
  if (result.rowCount === 0) return null;
  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return null;
  return { user_id: user.user_id, email: user.email, role: user.role } as AuthUser;
}

export function signJwt(payload: { user_id: number; role: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing from .env.local');
  return jwt.sign(payload, secret, { expiresIn: '2h' });
}

export function verifyJwt(token: string): JwtPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing from .env.local');
  try {
    return jwt.verify(token, secret) as JwtPayload;
  } catch {
    return null;
  }
}

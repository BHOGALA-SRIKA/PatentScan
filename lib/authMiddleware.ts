import { verifyJwt } from '@/lib/auth';
import type { JwtPayload } from 'jsonwebtoken';
import type { NextRequest } from 'next/server';

export interface AuthPayload extends JwtPayload {
  user_id: number;
  role: string;
}

export function getAuthUser(req: NextRequest): AuthPayload | null {
  const token = req.cookies.get('auth_token')?.value;
  if (!token) return null;
  const payload = verifyJwt(token) as AuthPayload | null;
  return payload;
}

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string | null;
}

export async function GET(_req: NextRequest) {
  try {
    const [rows] = await pool.query<UserRow[]>(
      `SELECT id, name, email
       FROM users
       WHERE email IS NOT NULL AND email <> ''
       ORDER BY name ASC`
    );
    return NextResponse.json({ users: rows });
  } catch (e) {
    console.error('GET /api/users failed', e);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

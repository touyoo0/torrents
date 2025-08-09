import { NextRequest } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';

function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const trimmed = ip.trim();
  if (trimmed.startsWith('::ffff:')) return trimmed.replace('::ffff:', '');
  return trimmed;
}

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for') || '';
  const xri = req.headers.get('x-real-ip') || '';
  const fromXff = xff.split(',')[0]?.trim();
  const ip = fromXff || xri || (req as any).ip || '';
  return normalizeIp(ip);
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!ip) {
      return new Response(JSON.stringify({ user: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const query = `
      SELECT name AS username, team
      FROM users
      WHERE FIND_IN_SET(?, ip_adresses) OR ip_adresses = ?
      ORDER BY last_activity DESC
      LIMIT 1
    `;
    const [rows] = await pool.query<RowDataPacket[]>(query, [ip, ip]);
    if ((rows as any).length > 0) {
      const r: any = (rows as any)[0];
      const username = typeof r.username === 'string' ? r.username : null;
      const team = typeof r.team === 'string' ? r.team : '';
      if (username) {
        return new Response(JSON.stringify({ user: { username, team } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return new Response(JSON.stringify({ user: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('whoami error', e);
    return new Response(JSON.stringify({ user: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
}

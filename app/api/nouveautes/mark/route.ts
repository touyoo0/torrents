import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

function normalizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let t = ip.trim();
  if (t.startsWith('::ffff:')) t = t.replace('::ffff:', '');
  if (t === '::1' || t === '0:0:0:0:0:0:0:1') t = '127.0.0.1';
  if (/^\d+\.\d+\.\d+\.\d+:.+$/.test(t)) t = t.split(':')[0];
  return t;
}

function getClientIp(req: NextRequest): string | null {
  const directIp = (req as any).ip as string | undefined;
  const xfwd = req.headers.get('x-forwarded-for') || '';
  const xri = req.headers.get('x-real-ip') || '';
  const fromXff = xfwd.split(',')[0]?.trim();
  return normalizeIp(directIp || fromXff || xri || '');
}

async function updateLastActivityForIp(ip: string | null): Promise<void> {
  if (!ip) return;
  const updateQuery = `
    UPDATE users
    SET last_activity = NOW()
    WHERE (
      (JSON_VALID(ip_adresses) AND JSON_CONTAINS(CAST(ip_adresses AS JSON), JSON_QUOTE(?)))
      OR ip_adresses = ?
      OR FIND_IN_SET(?, REPLACE(REPLACE(REPLACE(ip_adresses,'"',''), '[',''),']',''))
    )
  `;
  await pool.query(updateQuery, [ip, ip, ip]);
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    await updateLastActivityForIp(ip);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Failed to mark nouveautes as read', e);
    return NextResponse.json({ ok: false, error: 'Failed to mark as read' }, { status: 500 });
  }
}

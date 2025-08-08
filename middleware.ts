import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getClientIp(req: NextRequest): string {
  // Try Next.js provided IP first (may be undefined depending on host)
  const direct = (req as any).ip as string | undefined;

  // Common proxy headers
  const xff = req.headers.get('x-forwarded-for');
  const xri = req.headers.get('x-real-ip');

  // x-forwarded-for can be a list: client, proxy1, proxy2
  const xffClient = xff?.split(',')[0]?.trim();

  return direct || xffClient || xri || 'unknown';
}

export function middleware(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const url = req.nextUrl.pathname + (req.nextUrl.search || '');
    const method = req.method;

    // Log format: [IP] METHOD URL
    console.log(`[visit] [${ip}] ${method} ${url}`);
  } catch (e) {
    console.error('[visit] error logging IP', e);
  }
  return NextResponse.next();
}

// Exclude Next.js internals and static assets from middleware for performance
export const config = {
  matcher: [
    // Run on all paths except Next internals and common static files
    '/((?!_next/|_next-static|_next-image|favicon\\.ico|robots\\.txt|sitemap\\.xml|static/|assets/).*)',
  ],
};

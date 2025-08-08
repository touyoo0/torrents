import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

/**
 * API endpoint to trigger an Airflow DAG
 * 
 * @param req Request object containing the DAG ID and parameters
 * @returns Response with status of the DAG trigger
 */
export async function POST(req: NextRequest) {
  console.log('Airflow API endpoint called');
  try {
    // Extract DAG ID and parameters from request
    const { dagId, params } = await req.json();
    
    // Resolve client IP -> username from src/config/users.json
    type UsersConfig = { users: Record<string, { team: string; ip_addresses: string[] }> };
    const normalizeIp = (ip: string | null | undefined) => {
      if (!ip) return null;
      const t = ip.trim();
      if (t === '::1') return '127.0.0.1';
      return t.startsWith('::ffff:') ? t.replace('::ffff:', '') : t;
    };
    const getClientIp = (request: NextRequest): string | null => {
      const xff = request.headers.get('x-forwarded-for') || '';
      const xri = request.headers.get('x-real-ip') || '';
      const fromXff = xff.split(',')[0]?.trim();
      return normalizeIp(fromXff || xri || (request as any).ip || '');
    };
    const resolveUserFromIp = async (ip: string | null): Promise<string | null> => {
      if (!ip) return null;
      try {
        const usersPath = path.join(process.cwd(), 'src', 'config', 'users.json');
        const raw = await fs.readFile(usersPath, 'utf8');
        const cfg = JSON.parse(raw) as UsersConfig;
        const norm = normalizeIp(ip);
        for (const [username, meta] of Object.entries(cfg.users || {})) {
          const list = Array.isArray(meta.ip_addresses) ? meta.ip_addresses : [];
          if (list.some(v => normalizeIp(v) === norm)) return username;
        }
        return null;
      } catch (e) {
        console.error('users.json read/parse error:', e);
        return null;
      }
    };
    const clientIp = getClientIp(req);
    const resolvedUser = await resolveUserFromIp(clientIp);
    
    if (!dagId) {
      return NextResponse.json({ error: 'DAG ID is required' }, { status: 400 });
    }

    console.log(`Triggering DAG: ${dagId} with params:`, params);
    
    // Airflow API configuration
    const airflowUrl = 'http://192.168.1.31:8081/api/v1';
    const username = 'touyoo';
    const password = 'touyoo';
    
    // Create request body (inject user if resolved)
    const requestBody = {
      dag_run_id: `manual_${Date.now()}`,
      conf: { ...(params || {}), ...(resolvedUser ? { user: resolvedUser } : {}) }
    };
    
    // API endpoint URL
    const fullUrl = `${airflowUrl}/dags/${dagId}/dagRuns`;
    console.log(`API URL: ${fullUrl}`);
    
    // Make the API call
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
      },
      body: JSON.stringify(requestBody)
    });
    
    // Get response text
    const responseText = await response.text();
    console.log(`Response status: ${response.status}`);
    console.log('Response text:', responseText);
    
    // Handle error response
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to trigger Airflow DAG', status: response.status }, 
        { status: response.status }
      );
    }
    
    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

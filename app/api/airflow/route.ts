import { NextRequest, NextResponse } from 'next/server';

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
    
    if (!dagId) {
      return NextResponse.json({ error: 'DAG ID is required' }, { status: 400 });
    }

    console.log(`Triggering DAG: ${dagId} with params:`, params);
    
    // Airflow API configuration via env vars
    const airflowUrl = process.env.AIRFLOW_API_URL;
    const username = process.env.AIRFLOW_USERNAME;
    const password = process.env.AIRFLOW_PASSWORD;

    if (!airflowUrl || !username || !password) {
      console.error('Missing Airflow env vars. Required: AIRFLOW_API_URL, AIRFLOW_USERNAME, AIRFLOW_PASSWORD');
      return NextResponse.json(
        { error: 'Airflow configuration missing on server (env vars)' },
        { status: 500 }
      );
    }
    
    // Create request body
    const requestBody = {
      dag_run_id: `manual_${Date.now()}`,
      conf: { ...(params || {}) }
    };
    
    // API endpoint URL
    const base = airflowUrl.endsWith('/') ? airflowUrl.slice(0, -1) : airflowUrl;
    const fullUrl = `${base}/dags/${dagId}/dagRuns`;
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

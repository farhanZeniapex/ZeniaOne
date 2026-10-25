import { NextResponse } from 'next/server';

const apiBaseUrl = (process.env.ZENIAONE_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8002/api/v1").replace(/\/$/, '');

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        // ZeniaHR Company ID is securely kept on the server side
        const companyId = process.env.ZENIAHR_COMPANY_ID || "603d2b5b9f1b2c3d4e5f6a7b";
        
        const res = await fetch(`${apiBaseUrl}/companies/${companyId}/leads/public`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        });
        
        if (!res.ok) {
            const error = await res.json();
            return NextResponse.json({ error: error.detail || 'Failed to submit lead' }, { status: res.status });
        }
        
        return NextResponse.json({ status: 'success' });
        
    } catch (error) {
        console.error("Lead submission error:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

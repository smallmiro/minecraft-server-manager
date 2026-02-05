import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

/**
 * Maximum number of rows to export
 */
const MAX_EXPORT_ROWS = 5000;

/**
 * GET /api/audit-logs/export
 * BFF export endpoint: Fetch audit logs and return as CSV or JSON download
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get export parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Build query params for mcctl-api, capping at MAX_EXPORT_ROWS
    const apiParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
      if (key !== 'format') {
        apiParams.set(key, value);
      }
    });
    apiParams.set('limit', String(MAX_EXPORT_ROWS));
    apiParams.delete('offset');

    const apiUrl = process.env.MCCTL_API_URL || 'http://localhost:5001';
    const apiKey = process.env.MCCTL_API_KEY || '';

    const response = await fetch(
      `${apiUrl}/api/audit-logs?${apiParams.toString()}`,
      {
        headers: {
          'X-API-Key': apiKey,
          'X-User': session.user.name || session.user.email,
          'X-Role': session.user.role || 'user',
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({
        error: 'UnknownError',
        message: response.statusText,
      }));
      return NextResponse.json(errorBody, { status: response.status });
    }

    const data = await response.json();
    const logs = data.logs || [];

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'ID,Timestamp,Action,Actor,Target Type,Target Name,Status,Error Message,Details';
      const csvRows = logs.map((log: Record<string, unknown>) => {
        const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : '';
        const errorMessage = (log.errorMessage as string || '').replace(/"/g, '""');
        return [
          log.id,
          log.timestamp,
          log.action,
          log.actor,
          log.targetType,
          log.targetName,
          log.status,
          `"${errorMessage}"`,
          `"${details}"`,
        ].join(',');
      });

      const csv = [csvHeader, ...csvRows].join('\n');

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-logs-${timestamp}.csv"`,
        },
      });
    }

    // JSON format
    const jsonExport = {
      exportedAt: new Date().toISOString(),
      filters: data.filters,
      total: logs.length,
      logs,
    };

    return new Response(JSON.stringify(jsonExport, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${timestamp}.json"`,
      },
    });
  } catch (error) {
    console.error('Failed to export audit logs:', error);
    return NextResponse.json(
      { error: 'InternalServerError', message: 'Failed to export audit logs' },
      { status: 500 }
    );
  }
}

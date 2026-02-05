'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import DownloadIcon from '@mui/icons-material/Download';
import type { AuditLogQueryParams } from '@/types/audit-log';

export interface AuditLogExportProps {
  open: boolean;
  onClose: () => void;
  filters: AuditLogQueryParams;
  totalCount: number;
}

const MAX_EXPORT_ROWS = 5000;

/**
 * Build export URL from filters and format
 */
function buildExportUrl(filters: AuditLogQueryParams, format: 'csv' | 'json'): string {
  const params = new URLSearchParams();
  params.set('format', format);

  if (filters.action) params.set('action', filters.action);
  if (filters.actor) params.set('actor', filters.actor);
  if (filters.targetType) params.set('targetType', filters.targetType);
  if (filters.targetName) params.set('targetName', filters.targetName);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);

  return `/api/audit-logs/export?${params.toString()}`;
}

/**
 * Summarize active filters for display
 */
function summarizeFilters(filters: AuditLogQueryParams): string[] {
  const summary: string[] = [];
  if (filters.action) summary.push(`Action: ${filters.action}`);
  if (filters.actor) summary.push(`Actor: ${filters.actor}`);
  if (filters.targetType) summary.push(`Type: ${filters.targetType}`);
  if (filters.targetName) summary.push(`Target: ${filters.targetName}`);
  if (filters.status) summary.push(`Status: ${filters.status}`);
  if (filters.from) summary.push(`From: ${filters.from.split('T')[0]}`);
  if (filters.to) summary.push(`To: ${filters.to.split('T')[0]}`);
  return summary;
}

/**
 * Export dialog component
 * Allows users to export audit logs as CSV or JSON
 */
export function AuditLogExport({ open, onClose, filters, totalCount }: AuditLogExportProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filterSummary = summarizeFilters(filters);
  const exportCount = Math.min(totalCount, MAX_EXPORT_ROWS);
  const isOverLimit = totalCount > MAX_EXPORT_ROWS;

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      const url = buildExportUrl(filters, format);
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Export failed' }));
        throw new Error(errorData.message || 'Export failed');
      }

      // Download the file
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;

      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
      a.download = filenameMatch?.[1] || `audit-logs.${format}`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Audit Logs</DialogTitle>
      <DialogContent>
        {/* Format selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Format
          </Typography>
          <ToggleButtonGroup
            value={format}
            exclusive
            onChange={(_, newFormat) => newFormat && setFormat(newFormat)}
            size="small"
          >
            <ToggleButton value="csv">CSV</ToggleButton>
            <ToggleButton value="json">JSON</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Filter summary */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Applied Filters
          </Typography>
          {filterSummary.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {filterSummary.map((item) => (
                <Typography key={item} variant="body2" color="text.secondary">
                  {item}
                </Typography>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No filters applied (all logs)
            </Typography>
          )}
        </Box>

        {/* Export count */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Estimated Rows
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {exportCount.toLocaleString()} rows
          </Typography>
        </Box>

        {/* Over limit warning */}
        {isOverLimit && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Export is limited to {MAX_EXPORT_ROWS.toLocaleString()} rows.
            Total matching logs: {totalCount.toLocaleString()}.
            Consider narrowing your filters for a complete export.
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isExporting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting...' : `Export ${format.toUpperCase()}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

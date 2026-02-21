'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Link from 'next/link';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { AuditLogTable } from '@/components/audit-logs/AuditLogTable';
import { useServerAuditLogs } from '@/hooks/useAuditLogs';
import type { AuditLogQueryParams } from '@/types/audit-log';
import { SERVER_ACTIONS, AUDIT_ACTION_LABELS } from '@/types/audit-log';

export interface ServerActivityTabProps {
  serverName: string;
}

/**
 * Server Activity Tab component
 * Shows audit logs for a specific server in a table format
 * matching the main Audit Logs page UI
 */
export function ServerActivityTab({ serverName }: ServerActivityTabProps) {
  const [filters, setFilters] = useState<AuditLogQueryParams>({
    limit: 25,
    offset: 0,
  });

  const { data, isLoading, error, refetch } = useServerAuditLogs(serverName, {
    limit: filters.limit,
    extraParams: {
      offset: filters.offset,
      action: filters.action,
      status: filters.status,
    },
  });

  const handleFiltersChange = (newFilters: AuditLogQueryParams) => {
    setFilters(newFilters);
  };

  const handleActionChange = (value: string | undefined) => {
    setFilters((prev) => ({
      ...prev,
      action: value || undefined,
      offset: 0,
    }));
  };

  const handleStatusChange = (_: unknown, value: string | null) => {
    setFilters((prev) => ({
      ...prev,
      status: value || undefined,
      offset: 0,
    }));
  };

  const viewAllHref = `/audit-logs?targetType=server&targetName=${encodeURIComponent(serverName)}`;

  return (
    <Box>
      {/* Inline filters */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 2,
          alignItems: { sm: 'center' },
        }}
      >
        {/* Action filter */}
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Action</InputLabel>
          <Select
            value={filters.action || ''}
            label="Action"
            onChange={(e) => handleActionChange(e.target.value || undefined)}
          >
            <MenuItem value="">All Actions</MenuItem>
            {SERVER_ACTIONS.map((action) => (
              <MenuItem key={action} value={action}>
                {AUDIT_ACTION_LABELS[action] || action}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Status filter */}
        <ToggleButtonGroup
          value={filters.status || ''}
          exclusive
          onChange={handleStatusChange}
          size="small"
        >
          <ToggleButton value="" aria-label="All statuses">All</ToggleButton>
          <ToggleButton value="success" aria-label="Success only">Success</ToggleButton>
          <ToggleButton value="failure" aria-label="Failure only">Failure</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Audit log table (reused from audit-logs page, hiding Target column) */}
      <AuditLogTable
        logs={data?.logs ?? []}
        total={data?.total ?? 0}
        isLoading={isLoading}
        error={error}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onRetry={() => refetch()}
        hideTargetColumn
        rowsPerPageOptions={[25, 50]}
      />

      {/* View full history link */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Button
          component={Link}
          href={viewAllHref}
          size="small"
          endIcon={<ArrowForwardIcon />}
          sx={{ textTransform: 'none' }}
        >
          View Full History
        </Button>
      </Box>
    </Box>
  );
}

'use client';

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import RestoreIcon from '@mui/icons-material/Restore';
import { useBackupHistory } from '@/hooks/useMcctl';
import { BackupRestoreDialog } from './BackupRestoreDialog';
import type { BackupCommit } from '@/ports/api/IMcctlApiClient';

/**
 * Format timestamp to readable date
 */
function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function BackupHistory() {
  const { data, isLoading, error } = useBackupHistory(20);
  const [selectedCommit, setSelectedCommit] = useState<BackupCommit | null>(null);

  const handleRestoreClick = (commit: BackupCommit) => {
    setSelectedCommit(commit);
  };

  const handleRestoreClose = () => {
    setSelectedCommit(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup History
          </Typography>
          <Typography color="text.secondary">Loading...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup History
          </Typography>
          <Typography color="error">Failed to load backup history</Typography>
        </CardContent>
      </Card>
    );
  }

  const commits = data?.commits || [];

  return (
    <>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Backup History
          </Typography>

          {commits.length === 0 ? (
            <Typography color="text.secondary">No backup history available</Typography>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Commit</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell>Author</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {commits.map((commit: BackupCommit) => (
                    <TableRow key={commit.hash}>
                      <TableCell>
                        <Chip
                          label={commit.hash.substring(0, 7)}
                          size="small"
                          variant="outlined"
                          sx={{ fontFamily: 'monospace' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{formatDateTime(commit.date)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{commit.message}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {commit.author}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => handleRestoreClick(commit)}
                          title="Restore this backup"
                        >
                          <RestoreIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {selectedCommit && (
        <BackupRestoreDialog
          open={!!selectedCommit}
          commit={selectedCommit}
          onClose={handleRestoreClose}
        />
      )}
    </>
  );
}

'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import InfoIcon from '@mui/icons-material/Info';
import { useSession } from '@/lib/auth-client';

const cellLabelSx = { fontWeight: 500, color: 'text.secondary', border: 0, width: '40%', py: 1 } as const;
const cellValueSx = { border: 0, py: 1 } as const;

function formatDate(date: string | Date | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AccountInfoSection() {
  const { data: session } = useSession();
  const user = session?.user;

  if (!user) return null;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <InfoIcon color="primary" />
          <Typography variant="h6" component="h2">
            Account Information
          </Typography>
        </Box>

        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={cellLabelSx}>Account ID</TableCell>
              <TableCell sx={cellValueSx}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                  {user.id}
                </Typography>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Created</TableCell>
              <TableCell sx={cellValueSx}>{formatDate(user.createdAt)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Last Updated</TableCell>
              <TableCell sx={cellValueSx}>{formatDate(user.updatedAt)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

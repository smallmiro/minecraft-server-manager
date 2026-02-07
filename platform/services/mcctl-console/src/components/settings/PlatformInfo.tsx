'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type { RouterDetail } from '@/ports/api/IMcctlApiClient';

interface PlatformInfoProps {
  router: RouterDetail;
}

const cellLabelSx = { fontWeight: 500, color: 'text.secondary', border: 0, width: '40%', py: 1 } as const;
const cellValueSx = { border: 0, py: 1 } as const;

export function PlatformInfo({ router }: PlatformInfoProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <InfoOutlinedIcon color="primary" />
          <Typography variant="h6" component="h2">
            Platform Information
          </Typography>
        </Box>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell sx={cellLabelSx}>Router Name</TableCell>
              <TableCell sx={cellValueSx}>{router.name}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Port</TableCell>
              <TableCell sx={cellValueSx}>{router.port}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Mode</TableCell>
              <TableCell sx={cellValueSx}>{router.mode || '-'}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={cellLabelSx}>Uptime</TableCell>
              <TableCell sx={cellValueSx}>{router.uptime || '-'}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

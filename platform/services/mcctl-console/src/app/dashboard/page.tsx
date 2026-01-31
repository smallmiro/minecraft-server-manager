'use client';

import { Box, Typography, Container } from '@mui/material';

export default function DashboardPage() {
  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome to the Minecraft Server Manager dashboard.
        </Typography>
      </Box>
    </Container>
  );
}

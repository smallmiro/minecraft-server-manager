'use client';

import { Box, Container, Typography, Card, CardContent, Button, Stack } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

export default function Home() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Container maxWidth="sm">
        <Card>
          <CardContent>
            <Stack spacing={3} alignItems="center">
              <StorageIcon sx={{ fontSize: 64, color: 'primary.main' }} />

              <Typography variant="h4" component="h1" align="center" fontWeight="bold">
                Minecraft Server Manager
              </Typography>

              <Typography variant="body1" color="text.secondary" align="center">
                Web-based management console for Minecraft server infrastructure.
                Real-time monitoring, server lifecycle management, and more.
              </Typography>

              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  className="hover:bg-primary-dark"
                >
                  Get Started
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                >
                  Documentation
                </Button>
              </Stack>

              <Box className="mt-4 p-4 rounded-lg bg-background-paper">
                <Typography variant="caption" color="text.secondary">
                  MUI + Tailwind CSS Integration Working
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}

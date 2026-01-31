'use client';

import { useRouter } from 'next/navigation';
import { Box, Card, CardContent, Typography, Link, Container } from '@mui/material';
import { LoginForm } from '@/components/auth';
import NextLink from 'next/link';

export default function LoginPage() {
  const router = useRouter();

  const handleLoginSuccess = () => {
    // Redirect to dashboard after successful login
    router.push('/dashboard');
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 4,
        }}
      >
        <Card sx={{ width: '100%', maxWidth: 500 }}>
          <CardContent sx={{ p: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              sx={{ fontWeight: 600, textAlign: 'center', mb: 3 }}
            >
              Welcome Back
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', mb: 4 }}
            >
              Sign in to manage your Minecraft servers
            </Typography>

            <LoginForm onSuccess={handleLoginSuccess} />

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Don&apos;t have an account?{' '}
                <Link component={NextLink} href="/signup" underline="hover">
                  Sign up
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

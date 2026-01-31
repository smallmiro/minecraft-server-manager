'use client';

import { useRouter } from 'next/navigation';
import { Box, Card, CardContent, Typography, Link, Container } from '@mui/material';
import { SignUpForm } from '@/components/auth';
import NextLink from 'next/link';

export default function SignUpPage() {
  const router = useRouter();

  const handleSignUpSuccess = () => {
    // Redirect to dashboard after successful signup
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
              Create Account
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: 'center', mb: 4 }}
            >
              Sign up to start managing Minecraft servers
            </Typography>

            <SignUpForm onSuccess={handleSignUpSuccess} />

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Already have an account?{' '}
                <Link component={NextLink} href="/login" underline="hover">
                  Sign in
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

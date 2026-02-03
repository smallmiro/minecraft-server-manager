'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import GitHubIcon from '@mui/icons-material/GitHub';
import MenuBookIcon from '@mui/icons-material/MenuBook';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const footerSections: FooterSection[] = [
  {
    title: 'Resources',
    links: [
      { label: 'Getting Started', href: '/docs/getting-started' },
      { label: 'Configuration', href: '/docs/configuration' },
      { label: 'Troubleshooting', href: '/docs/troubleshooting' },
    ],
  },
  {
    title: 'Documentation',
    links: [
      { label: 'CLI Commands', href: '/docs/cli' },
      { label: 'API Reference', href: '/docs/api' },
      { label: 'Environment Variables', href: '/docs/env' },
    ],
  },
  {
    title: 'Community',
    links: [
      {
        label: 'GitHub',
        href: 'https://github.com/itzg/docker-minecraft-server',
        external: true,
      },
      {
        label: 'Contribute',
        href: 'https://github.com/itzg/docker-minecraft-server/blob/master/CONTRIBUTING.md',
        external: true,
      },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'License', href: '/docs/license' },
      {
        label: 'itzg/minecraft-server',
        href: 'https://hub.docker.com/r/itzg/minecraft-server',
        external: true,
      },
    ],
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        backgroundColor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg" sx={{ py: 6 }}>
        {/* Footer Links Grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, 1fr)',
              sm: 'repeat(4, 1fr)',
            },
            gap: 4,
            mb: 4,
          }}
        >
          {footerSections.map((section) => (
            <Box key={section.title}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  color: 'text.primary',
                  mb: 2,
                }}
              >
                {section.title}
              </Typography>
              <Box
                component="ul"
                sx={{
                  listStyle: 'none',
                  p: 0,
                  m: 0,
                }}
              >
                {section.links.map((link) => (
                  <Box component="li" key={link.label} sx={{ mb: 1 }}>
                    <Link
                      href={link.href}
                      target={link.external ? '_blank' : undefined}
                      rel={link.external ? 'noopener noreferrer' : undefined}
                      underline="hover"
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.875rem',
                        transition: 'color 0.2s ease',
                        '&:hover': {
                          color: 'primary.main',
                        },
                      }}
                    >
                      {link.label}
                    </Link>
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Bottom Section */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
          }}
        >
          {/* Copyright */}
          <Typography
            variant="body2"
            sx={{
              color: 'text.tertiary',
            }}
          >
            {currentYear} MCCTL. Built with{' '}
            <Link
              href="https://docker-minecraft-server.readthedocs.io/"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{ color: 'primary.main' }}
            >
              itzg/minecraft-server
            </Link>
          </Typography>

          {/* Social Links */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Link
              href="https://github.com/itzg/docker-minecraft-server"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              sx={{
                color: 'text.secondary',
                transition: 'color 0.2s ease',
                '&:hover': {
                  color: 'text.primary',
                },
              }}
            >
              <GitHubIcon fontSize="small" />
            </Link>
            <Link
              href="https://docker-minecraft-server.readthedocs.io/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Documentation"
              sx={{
                color: 'text.secondary',
                transition: 'color 0.2s ease',
                '&:hover': {
                  color: 'text.primary',
                },
              }}
            >
              <MenuBookIcon fontSize="small" />
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Divider from '@mui/material/Divider';
import GitHubIcon from '@mui/icons-material/GitHub';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SvgIcon from '@mui/material/SvgIcon';

// Docker icon SVG
function DockerIcon(props: React.ComponentProps<typeof SvgIcon>) {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.186m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288z" />
    </SvgIcon>
  );
}

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
      { label: 'Getting Started', href: 'https://minecraft-server-manager.readthedocs.io/en/latest/getting-started/', external: true },
      { label: 'Configuration', href: 'https://minecraft-server-manager.readthedocs.io/en/latest/configuration/', external: true },
      { label: 'Troubleshooting', href: 'https://minecraft-server-manager.readthedocs.io/en/latest/troubleshooting/', external: true },
    ],
  },
  {
    title: 'Documentation',
    links: [
      { label: 'CLI Commands', href: 'https://minecraft-server-manager.readthedocs.io/en/latest/cli/', external: true },
      { label: 'API Reference', href: 'https://minecraft-server-manager.readthedocs.io/en/latest/console/', external: true },
      { label: 'itzg Reference', href: 'https://minecraft-server-manager.readthedocs.io/en/latest/itzg-reference/', external: true },
    ],
  },
  {
    title: 'Community',
    links: [
      {
        label: 'GitHub',
        href: 'https://github.com/smallmiro/minecraft-server-manager',
        external: true,
      },
      {
        label: 'Issues',
        href: 'https://github.com/smallmiro/minecraft-server-manager/issues',
        external: true,
      },
    ],
  },
  {
    title: 'About',
    links: [
      { label: 'License', href: 'https://github.com/smallmiro/minecraft-server-manager/blob/main/LICENSE', external: true },
      {
        label: 'Docker Hub',
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
            {currentYear} ©{' '}
            <Link
              href="https://github.com/smallmiro/minecraft-server-manager"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              sx={{ color: 'primary.main' }}
            >
              Minecraft Server Management Console
            </Link>
          </Typography>

          {/* Social Links */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Link
              href="https://github.com/smallmiro/minecraft-server-manager"
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
              href="https://minecraft-server-manager.readthedocs.io/"
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
            <Link
              href="https://hub.docker.com/r/itzg/minecraft-server"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Docker Hub"
              sx={{
                color: 'text.secondary',
                transition: 'color 0.2s ease',
                '&:hover': {
                  color: 'text.primary',
                },
              }}
            >
              <DockerIcon fontSize="small" />
            </Link>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}

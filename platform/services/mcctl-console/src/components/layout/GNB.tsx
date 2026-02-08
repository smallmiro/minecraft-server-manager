'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DnsIcon from '@mui/icons-material/Dns';
import PeopleIcon from '@mui/icons-material/People';
import RouterIcon from '@mui/icons-material/Router';
import HistoryIcon from '@mui/icons-material/History';
import PublicIcon from '@mui/icons-material/Public';
import BackupIcon from '@mui/icons-material/Backup';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { UserMenu } from '@/components/auth';
import { CreeperIcon } from '@/components/icons/CreeperIcon';
import { startLoading } from '@/components/providers';
import { useSession } from '@/lib/auth-client';

export const GNB_HEIGHT = 64;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Servers', href: '/servers', icon: <DnsIcon /> },
  { label: 'Worlds', href: '/worlds', icon: <PublicIcon /> },
  { label: 'Players', href: '/players', icon: <PeopleIcon /> },
  { label: 'Audit Log', href: '/audit-logs', icon: <HistoryIcon /> },
  { label: 'Backups', href: '/backups', icon: <BackupIcon /> },
  { label: 'Routing', href: '/routing', icon: <RouterIcon /> },
];

const adminNavItem: NavItem = {
  label: 'Admin',
  href: '/admin',
  icon: <AdminPanelSettingsIcon />,
};

interface GNBProps {
  mobileOpen: boolean;
  onMenuToggle: () => void;
}

export function GNB({ mobileOpen, onMenuToggle }: GNBProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  const isAdmin = session?.user?.role === 'admin';
  const displayNavItems = isAdmin ? [...navItems, adminNavItem] : navItems;

  return (
    <>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backgroundColor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar
          sx={{
            maxWidth: '1400px',
            width: '100%',
            mx: 'auto',
            px: { xs: 2, sm: 3 },
          }}
        >
          {/* Mobile Menu Button */}
          <IconButton
            color="inherit"
            aria-label="open menu"
            edge="start"
            onClick={onMenuToggle}
            sx={{
              mr: 2,
              display: { md: 'none' },
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <CreeperIcon
              sx={{
                fontSize: 28,
                color: 'primary.main',
                mr: 1,
              }}
            />
            <Typography
              variant="h6"
              component="span"
              sx={{
                fontFamily: '"Minecraft", sans-serif',
                fontWeight: 400,
                color: 'common.white',
                letterSpacing: '0.05em',
                fontSize: '1.1rem',
              }}
            >
              Minecraft Console
            </Typography>
          </Link>

          {/* Desktop Navigation - Center */}
          <Box
            component="nav"
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              gap: 1,
              ml: 4,
              flex: 1,
            }}
          >
            {displayNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{ textDecoration: 'none' }}
                  onClick={() => !active && startLoading()}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      color: active ? 'primary.main' : 'text.secondary',
                      backgroundColor: active ? 'action.selected' : 'transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                        color: active ? 'primary.main' : 'text.primary',
                      },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        '& svg': {
                          fontSize: 20,
                        },
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                </Link>
              );
            })}
          </Box>

          {/* Right Section - User Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <UserMenu />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={onMenuToggle}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: 280,
            backgroundColor: 'background.paper',
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Drawer Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 2,
              py: 2,
              minHeight: GNB_HEIGHT,
              borderBottom: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <CreeperIcon
                sx={{
                  fontSize: 24,
                  color: 'primary.main',
                  mr: 1,
                }}
              />
              <Typography
                variant="h6"
                component="span"
                sx={{
                  fontFamily: '"Minecraft", sans-serif',
                  fontWeight: 400,
                  color: 'primary.main',
                  letterSpacing: '0.05em',
                  fontSize: '1rem',
                }}
              >
                Minecraft Console
              </Typography>
            </Box>
            <IconButton onClick={onMenuToggle} aria-label="close menu">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Mobile Navigation */}
          <List sx={{ flex: 1, px: 1, py: 2 }}>
            {displayNavItems.map((item) => {
              const active = isActive(item.href);
              return (
                <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    href={item.href}
                    onClick={() => {
                      onMenuToggle();
                      if (!active) startLoading();
                    }}
                    aria-current={active ? 'page' : undefined}
                    sx={{
                      borderRadius: 2,
                      backgroundColor: active ? 'action.selected' : 'transparent',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: active ? 'primary.main' : 'text.secondary',
                        minWidth: 40,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontWeight: active ? 600 : 400,
                        color: active ? 'primary.main' : 'text.primary',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>
    </>
  );
}

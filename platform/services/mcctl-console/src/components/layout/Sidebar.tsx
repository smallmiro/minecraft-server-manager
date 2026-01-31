'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DnsIcon from '@mui/icons-material/Dns';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';

export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_WIDTH_COLLAPSED = 72;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <DashboardIcon /> },
  { label: 'Servers', href: '/servers', icon: <DnsIcon /> },
  { label: 'Players', href: '/players', icon: <PeopleIcon /> },
  { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  const drawerContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Logo/Brand */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 2,
          minHeight: 64,
        }}
      >
        <Typography
          variant="h6"
          component="span"
          sx={{
            fontWeight: 700,
            color: 'primary.main',
            letterSpacing: '0.1em',
          }}
        >
          MCCTL
        </Typography>
        <IconButton
          onClick={onClose}
          aria-label="close sidebar"
          sx={{
            display: { xs: 'flex', lg: 'none' },
          }}
        >
          <ChevronLeftIcon />
        </IconButton>
      </Box>

      <Divider />

      {/* Navigation Items */}
      <List sx={{ flex: 1, px: 1, py: 2 }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                sx={{
                  borderRadius: 2,
                  backgroundColor: isActive ? 'primary.dark' : 'transparent',
                  '&:hover': {
                    backgroundColor: isActive ? 'primary.dark' : 'action.hover',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? 'primary.main' : 'text.secondary',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'primary.main' : 'text.primary',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={onClose}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: SIDEBAR_WIDTH,
            backgroundColor: 'background.paper',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', lg: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: SIDEBAR_WIDTH,
            backgroundColor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </>
  );
}

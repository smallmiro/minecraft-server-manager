'use client';

import type { CSSProperties } from 'react';
import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface TypographyVariants {
    mono: CSSProperties;
    label: CSSProperties;
  }
  interface TypographyVariantsOptions {
    mono?: CSSProperties;
    label?: CSSProperties;
  }
}

declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    mono: true;
    label: true;
  }
}

const monoFontFamily =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

// Modrinth-style color palette
const colors = {
  // Background colors (darkest to lightest)
  bgBase: '#16181c',
  bgRaised: '#1a1d22',
  bgSurface: '#26282e',
  bgElevated: '#313338',
  // Text colors
  textPrimary: '#ffffff',
  textSecondary: '#9a9a9a',
  textTertiary: '#72767d',
  // Border
  border: '#2e3035',
  // Brand colors
  primary: '#1bd96a',
  primaryLight: '#4de38a',
  primaryDark: '#15a852',
  secondary: '#7c3aed',
  secondaryLight: '#9f67f0',
  secondaryDark: '#5b21b6',
};

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: colors.primary,
      light: colors.primaryLight,
      dark: colors.primaryDark,
    },
    secondary: {
      main: colors.secondary,
      light: colors.secondaryLight,
      dark: colors.secondaryDark,
    },
    background: {
      default: colors.bgBase,
      paper: colors.bgRaised,
    },
    success: {
      main: '#22c55e',
    },
    error: {
      main: '#ef4444',
    },
    warning: {
      main: '#f59e0b',
    },
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
    },
    divider: colors.border,
    action: {
      hover: colors.bgSurface,
      selected: colors.bgSurface,
    },
  },
  typography: {
    // Technical values (container, host, version, metrics): fixed-width digits
    // so live updates do not shift the layout.
    mono: {
      fontFamily: monoFontFamily,
      fontVariantNumeric: 'tabular-nums',
      fontSize: '0.8125rem',
      lineHeight: 1.5,
    },
    // Small-caps style field label
    label: {
      fontSize: '0.6875rem',
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
  },
  components: {
    MuiTypography: {
      defaultProps: {
        variantMapping: { mono: 'span', label: 'span' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: colors.bgRaised,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          textTransform: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: colors.bgRaised,
          borderBottom: `1px solid ${colors.border}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: colors.bgRaised,
          borderRight: `1px solid ${colors.border}`,
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: `${colors.bgElevated} ${colors.bgBase}`,
          '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
            backgroundColor: colors.bgBase,
            width: 8,
          },
          '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
            borderRadius: 8,
            backgroundColor: colors.bgElevated,
            minHeight: 24,
          },
          '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
            backgroundColor: colors.bgSurface,
          },
        },
      },
    },
  },
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  important: '#__next',
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        // Modrinth-style background colors
        'bg-base': '#16181c',
        'bg-raised': '#1a1d22',
        'bg-surface': '#26282e',
        'bg-elevated': '#313338',
        // Modrinth-style text colors
        'text-primary': '#ffffff',
        'text-secondary': '#9a9a9a',
        'text-tertiary': '#72767d',
        // Border color
        'border-default': '#2e3035',
        // Brand colors
        primary: {
          DEFAULT: '#1bd96a',
          light: '#4de38a',
          dark: '#15a852',
        },
        secondary: {
          DEFAULT: '#7c3aed',
          light: '#9f67f0',
          dark: '#5b21b6',
        },
        background: {
          DEFAULT: '#16181c',
          paper: '#1a1d22',
        },
      },
    },
  },
  plugins: [],
};

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
          DEFAULT: '#111111',
          paper: '#1a1a1a',
        },
      },
    },
  },
  plugins: [],
};

import { ImageResponse } from 'next/og';
import type { CSSProperties } from 'react';

// iOS apple-touch-icon. Next.js auto-injects <link rel="apple-touch-icon"> from
// this file, and iOS uses it as the home-screen icon for the standalone PWA
// (#478). Generated as a PNG at build time via ImageResponse (Satori — no native
// image tooling required), so it works in build environments without a rasterizer.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Creeper face pixel rects, scaled from the 32-unit source grid to 180px (x5.625).
const pixel = (left: number, top: number, width: number, height: number): CSSProperties => ({
  position: 'absolute',
  left,
  top,
  width,
  height,
  backgroundColor: '#000',
});

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#5DA840',
        }}
      >
        {/* Eyes */}
        <div style={pixel(23, 45, 45, 45)} />
        <div style={pixel(113, 45, 45, 45)} />
        {/* Mouth */}
        <div style={pixel(68, 90, 45, 23)} />
        <div style={pixel(45, 113, 90, 45)} />
        <div style={pixel(45, 158, 23, 23)} />
        <div style={pixel(113, 158, 23, 23)} />
      </div>
    ),
    { ...size }
  );
}

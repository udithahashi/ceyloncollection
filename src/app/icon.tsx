import { ImageResponse } from 'next/og';

import { brand } from '@/lib/theme/tokens';

/**
 * A placeholder favicon, not a designed mark. The owner has hired a designer
 * for the real logo; this is just the brand's navy/gold pairing on initials
 * so the browser tab isn't the generic Next.js icon in the meantime. Delete
 * this file once a real icon.png (or favicon.ico) from the designer lands.
 */
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: brand.navy,
        color: brand.gold,
        fontSize: 16,
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}
    >
      CC
    </div>,
    { ...size }
  );
}

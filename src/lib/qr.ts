/**
 * QR code rendering.
 *
 * Generated on the server as inline SVG rather than in the browser, so no QR
 * library reaches the client bundle and no image request is made for something
 * that must never be cached or logged.
 *
 * SERVER ONLY.
 */
import QRCode from 'qrcode';

/**
 * Renders `data` as an inline SVG.
 *
 * Kept deliberately plain: paths and fill attributes only, no `style` attribute.
 * Our Content-Security-Policy allows styles by nonce in production, and a nonce
 * cannot authorise an inline style attribute, so an SVG carrying one would render
 * as a blank square.
 *
 * The colours are fixed black on white in both themes. Scanners expect dark
 * modules on a light background, and a QR code tinted to match a dark interface is
 * a QR code that does not scan.
 */
export async function renderQrSvg(data: string): Promise<string> {
  return QRCode.toString(data, {
    type: 'svg',
    // The white quiet zone is added by the surrounding padding in the UI instead,
    // so the SVG scales cleanly.
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

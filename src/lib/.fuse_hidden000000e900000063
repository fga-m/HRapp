import { ImageResponse } from "next/og";

// Brand navy used throughout the portal (sign-in badge, headings, etc.).
const NAVY = "#223149";

/**
 * Render the FGA wordmark on a navy field as a PNG, used for the favicon,
 * the iOS home-screen icon, and the Android/PWA manifest icons.
 *
 * - `rounded` adds a squircle corner radius (for tab favicons). iOS and
 *   Android apply their own masks, so home-screen icons stay full-bleed.
 * - `padScale` shrinks the wordmark toward the centre so it stays within the
 *   safe zone of a "maskable" icon (the OS may crop the outer ~10%).
 */
export function brandIcon(
  size: number,
  opts?: { rounded?: boolean; padScale?: number }
): ImageResponse {
  const padScale = opts?.padScale ?? 0;
  const rounded = opts?.rounded ?? false;
  const inner = size * (1 - padScale * 2);
  const fontSize = inner * 0.34;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: NAVY,
          borderRadius: rounded ? size * 0.22 : 0,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#ffffff",
            fontSize,
            fontWeight: 800,
            letterSpacing: -fontSize * 0.03,
          }}
        >
          FGA
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}

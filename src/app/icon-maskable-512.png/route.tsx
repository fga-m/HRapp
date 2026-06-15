import { brandIcon } from "@/lib/brand-icon";

// "Maskable" PWA icon: full-bleed navy with the wordmark pulled into the safe
// zone so Android adaptive icons don't crop it.
export const dynamic = "force-static";

export function GET() {
  return brandIcon(512, { padScale: 0.12 });
}

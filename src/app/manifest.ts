import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FGA Melbourne HR Portal",
    short_name: "FGA HR",
    description: "FGA Melbourne Staff HR Portal",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ECE3DF",
    theme_color: "#223149",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mahala HQ",
    short_name: "Mahala HQ",
    description: "Budgets, chores, calendar, and household info in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0d9488",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZE Order & Billing",
    short_name: "ZE",
    description: "Order & Billing System for Zahir Enterprise",
    start_url: "/",
    display: "standalone",
    background_color: "#081F3F",
    theme_color: "#081F3F",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

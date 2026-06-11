import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/japanese-grammar-srs/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "icons/apple-touch-icon.png",
        "icons/favicon.png",
        "icons/icon.svg",
      ],
      manifest: {
        name: "Minna SRS — Book 2",
        short_name: "Minna SRS",
        description:
          "Spaced-repetition grammar reviews for Minna no Nihongo Book 2.",
        theme_color: "#0a0a0a",
        background_color: "#fafafa",
        display: "standalone",
        orientation: "portrait",
        scope: "/japanese-grammar-srs/",
        start_url: "/japanese-grammar-srs/",
        lang: "en",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/japanese-grammar-srs/index.html",
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});

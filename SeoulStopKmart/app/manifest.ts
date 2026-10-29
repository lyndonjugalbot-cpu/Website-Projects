import type { MetadataRoute } from "next";

// Lets the store computer install the register as its own app window
// (Chrome/Edge: Install icon in the address bar, or menu → "Install"). It opens
// straight to the POS. This isn't what keeps staff out; the device lock does.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Seoul Stop Kmart POS",
    short_name: "SSK POS",
    description: "Seoul Stop Kmart point of sale",
    start_url: "/admin/pos",
    scope: "/admin/",
    display: "standalone",
    background_color: "#171412",
    theme_color: "#171412",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

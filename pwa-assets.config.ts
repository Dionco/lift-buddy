import {
  defineConfig,
  minimal2023Preset as preset,
} from "@vite-pwa/assets-generator/config";

export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  preset: {
    ...preset,
    transparent: {
      ...preset.transparent,
      sizes: [64, 192, 512],
      favicons: [[48, "favicon.ico"]],
    },
    maskable: {
      ...preset.maskable,
      sizes: [512],
      padding: 0.3,
      resizeOptions: { background: "#F5F2EC", fit: "contain" },
    },
    apple: {
      ...preset.apple,
      sizes: [180],
      padding: 0.3,
      resizeOptions: { background: "#F5F2EC", fit: "contain" },
    },
  },
  images: ["public/icon.svg"],
});

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Soft, desaturated swim-lane fills (see SPEC.md palette)
        peach: "#FBCFB0",
        salmon: "#F4A79D",
        rose: "#F2A7B8",
        sky: "#B3D9F5",
        mint: "#A8E6D0",
        lemon: "#FAF09E",
        lavender: "#D5C5F0",
        graytone: "#DDDBD5",
      },
      gridTemplateColumns: {
        // Fallback; real grid columns are computed inline from the date range.
        cell: "minmax(44px, 1fr)",
      },
    },
  },
  plugins: [],
};

export default config;

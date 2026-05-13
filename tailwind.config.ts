import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'coffee': {
          DEFAULT: '#3d2b1f',
          light: '#5c3d2b',
        },
        'gold': {
          DEFAULT: '#d4af37',
          dark: '#b8962e',
        }
      },
    },
  },
  plugins: [],
};
export default config;

import daisyui from "daisyui"

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/entrypoints/popup/*.{ts,tsx}",
    "./src/components/popup/*.{ts,tsx}"
  ],
  darkMode: "media",
  plugins: [daisyui]
}

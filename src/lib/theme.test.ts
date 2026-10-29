import { describe, expect, it } from "vitest"
import { applyTheme, themeItem } from "./theme"

describe("applyTheme", () => {
  it("sets data-wxrun-theme for a theme and removes it for original", () => {
    const root = document.createElement("html")
    applyTheme(root, "dark")
    expect(root.getAttribute("data-wxrun-theme")).toBe("dark")
    applyTheme(root, "original")
    expect(root.hasAttribute("data-wxrun-theme")).toBe(false)
  })
})

describe("themeItem", () => {
  it("falls back to original", async () => {
    expect(await themeItem.getValue()).toBe("original")
  })
})

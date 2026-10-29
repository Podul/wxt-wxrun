import { describe, expect, it } from "vitest"
import { applyLayout, applyTheme, layoutItem, themeItem } from "./theme"

describe("applyLayout", () => {
  it("sets data-wxrun-layout when enabled and removes it when disabled", () => {
    const root = document.createElement("html")
    applyLayout(root, true)
    expect(root.getAttribute("data-wxrun-layout")).toBe("web")
    applyLayout(root, false)
    expect(root.hasAttribute("data-wxrun-layout")).toBe(false)
  })
})

describe("layoutItem", () => {
  it("falls back to enabled", async () => {
    expect(await layoutItem.getValue()).toBe(true)
  })
})

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

export type ThemeId = "original" | "dark" | "green" | "sepia"

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: "original", label: "原始" },
  { id: "dark", label: "暗色" },
  { id: "green", label: "护眼绿" },
  { id: "sepia", label: "羊皮纸" }
]

export const themeItem = storage.defineItem<ThemeId>("local:theme", {
  fallback: "original"
})

export const layoutItem = storage.defineItem<boolean>("local:layout", {
  fallback: true
})

export function applyLayout(root: HTMLElement, enabled: boolean) {
  if (enabled) {
    root.setAttribute("data-wxrun-layout", "web")
  } else {
    root.removeAttribute("data-wxrun-layout")
  }
}

export function applyTheme(root: HTMLElement, theme: ThemeId) {
  if (theme === "original") {
    root.removeAttribute("data-wxrun-theme")
  } else {
    root.setAttribute("data-wxrun-theme", theme)
  }
}

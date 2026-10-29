import { layoutItem, themeItem, THEMES, type ThemeId } from "@/lib/theme"
import { useEffect, useState } from "react"

export default function PopupPage() {
  const [theme, setTheme] = useState<ThemeId>("original")
  const [layout, setLayout] = useState(true)

  useEffect(() => {
    themeItem.getValue().then(setTheme)
    layoutItem.getValue().then(setLayout)
  }, [])

  function onThemeChanged(value: ThemeId) {
    setTheme(value)
    themeItem.setValue(value)
  }

  function onLayoutChanged(value: boolean) {
    setLayout(value)
    layoutItem.setValue(value)
  }

  return (
    <div className="w-48 p-4">
      <label className="mb-3 flex cursor-pointer items-center justify-between font-bold">
        网站布局
        <input
          type="checkbox"
          className="toggle toggle-sm"
          checked={layout}
          onChange={(e) => onLayoutChanged(e.target.checked)}
        />
      </label>
      <div className="mb-2 font-bold">主题</div>
      {THEMES.map(({ id, label }) => (
        <label key={id} className="flex cursor-pointer items-center gap-2 py-1">
          <input
            type="radio"
            name="theme"
            className="radio radio-sm"
            checked={theme === id}
            onChange={() => onThemeChanged(id)}
          />
          {label}
        </label>
      ))}
    </div>
  )
}

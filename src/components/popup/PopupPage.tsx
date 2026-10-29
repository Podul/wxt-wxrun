import { themeItem, THEMES, type ThemeId } from "@/lib/theme"
import { useEffect, useState } from "react"

export default function PopupPage() {
  const [theme, setTheme] = useState<ThemeId>("original")

  useEffect(() => {
    themeItem.getValue().then(setTheme)
  }, [])

  function onThemeChanged(value: ThemeId) {
    setTheme(value)
    themeItem.setValue(value)
  }

  return (
    <div className="w-48 p-4">
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

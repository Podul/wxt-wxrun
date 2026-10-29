import { applyLayout, applyTheme, layoutItem, themeItem } from "@/lib/theme"
import "./styles/layout.css"
import "./styles/theme.css"

export default defineContentScript({
  matches: ["*://www.wxrun.com/*", "*://wxrun.com/*", "*://cat.wxrun.com/*"],
  allFrames: true,
  runAt: "document_start",
  async main(ctx) {
    const root = document.documentElement
    applyTheme(root, await themeItem.getValue())
    applyLayout(root, await layoutItem.getValue())
    const unwatchTheme = themeItem.watch((theme) => applyTheme(root, theme))
    const unwatchLayout = layoutItem.watch((on) => applyLayout(root, on))
    ctx.onInvalidated(() => {
      unwatchTheme()
      unwatchLayout()
    })
  }
})

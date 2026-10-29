import { applyTheme, themeItem } from "@/lib/theme"
import "./styles/theme.css"

export default defineContentScript({
  matches: ["*://www.wxrun.com/*", "*://wxrun.com/*", "*://cat.wxrun.com/*"],
  allFrames: true,
  runAt: "document_start",
  async main(ctx) {
    const root = document.documentElement
    applyTheme(root, await themeItem.getValue())
    const unwatch = themeItem.watch((theme) => applyTheme(root, theme))
    ctx.onInvalidated(unwatch)
  }
})

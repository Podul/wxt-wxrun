import { mountHeader, unmountHeader } from "@/lib/layout/header"
import { applyLayout, applyTheme, layoutItem, themeItem } from "@/lib/theme"
import "./styles/layout.css"
import "./styles/theme.css"

// 顶部导航只注入 uni-app 应用本身（cat.wxrun.com），www 外壳只用 CSS。
const isApp = location.hostname === "cat.wxrun.com"

function syncHeader(on: boolean) {
  if (!isApp) return
  if (!on) return unmountHeader(document)
  if (document.body) return mountHeader(document)
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      if (document.documentElement.hasAttribute("data-wxrun-layout")) {
        mountHeader(document)
      }
    },
    { once: true }
  )
}

export default defineContentScript({
  matches: ["*://www.wxrun.com/*", "*://wxrun.com/*", "*://cat.wxrun.com/*"],
  allFrames: true,
  runAt: "document_start",
  async main(ctx) {
    const root = document.documentElement
    applyTheme(root, await themeItem.getValue())
    const layout = await layoutItem.getValue()
    applyLayout(root, layout)
    syncHeader(layout)
    const unwatchTheme = themeItem.watch((theme) => applyTheme(root, theme))
    const unwatchLayout = layoutItem.watch((on) => {
      applyLayout(root, on)
      syncHeader(on)
    })
    ctx.onInvalidated(() => {
      unwatchTheme()
      unwatchLayout()
      unmountHeader(document)
    })
  }
})

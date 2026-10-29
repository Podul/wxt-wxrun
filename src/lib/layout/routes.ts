export const NAV = [
  { label: "申论猫", path: "pages/index/index" },
  { label: "行测猫", path: "pages/xingce/index" },
  { label: "收藏", path: "pages/paper/paper_collect" },
  { label: "我的", path: "pages/user/user" }
]

export const BASE = "/mobile/"

const HOME = "pages/index/index"

/** 把 location 归一成 uni-app 页面路径，如 "pages/paper/list_one"。 */
export function routePath(pathname: string, hash = ""): string {
  const raw = hash.startsWith("#/") ? hash.slice(2) : pathname
  const path = raw
    .split("?", 1)[0]!
    .replace(/^\/?mobile\/?/, "")
    .replace(/^\/+|\/+$/g, "")
  return path || HOME
}

/** "pages/paper/list_one" -> "paper-list_one"，用于页面级 CSS 选择器。 */
export function pageKey(pathname: string, hash = ""): string {
  return routePath(pathname, hash)
    .replace(/^pages\//, "")
    .replace(/\//g, "-")
}

/** 返回当前页所属的导航项下标；无法归属时返回 -1。 */
export function activeNav(pathname: string, hash = ""): number {
  const path = routePath(pathname, hash)
  const exact = NAV.findIndex((item) => item.path === path)
  if (exact !== -1) return exact
  if (path.startsWith("pages/xingce/")) return 1
  if (path.startsWith("pages/paper/")) return 0
  if (/^pages\/(user|change_password|bind_mobile)/.test(path)) return 3
  return -1
}

import { mountStudy, unmountStudy } from "@/lib/study/panel"
import { activeNav, BASE, NAV, pageKey, routePath } from "./routes"

const HEADER_ID = "wxrun-header"
const PAPER_PAGE = "paper-paper_info"
const SEARCH_PATH = "pages/search/search"

type State = {
  header: HTMLElement
  observer: MutationObserver
  onPopState: () => void
  onKeyDown: (e: KeyboardEvent) => void
}

const states = new WeakMap<Document, State>()

function setText(el: Element, text: string) {
  if (el.textContent !== text) el.textContent = text
}

function setAttr(el: Element, name: string, value: string | null) {
  if (value === null) {
    if (el.hasAttribute(name)) el.removeAttribute(name)
  } else if (el.getAttribute(name) !== value) {
    el.setAttribute(name, value)
  }
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return (
    !!el &&
    (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  )
}

function isPlainClick(e: MouseEvent) {
  return e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
}

/** 通过站点自带的 tabbar 做单页切换；没有生效时退回整页跳转。 */
function goTab(doc: Document, index: number) {
  const win = doc.defaultView!
  const path = NAV[index]!.path
  const tab = doc.querySelectorAll<HTMLElement>(".uni-tabbar__item")[index]
  if (!tab) {
    win.location.assign(BASE + path)
    return
  }
  tab.click()
  win.setTimeout(() => {
    const { pathname, hash } = win.location
    if (routePath(pathname, hash) !== path) win.location.assign(BASE + path)
  }, 400)
}

function build(doc: Document) {
  const header = doc.createElement("header")
  header.id = HEADER_ID

  const bar = doc.createElement("div")
  bar.className = "wxrun-bar"

  const brand = doc.createElement("a")
  brand.className = "wxrun-brand"
  brand.href = BASE
  brand.textContent = "猫学网"
  brand.addEventListener("click", (e) => {
    if (!isPlainClick(e)) return
    e.preventDefault()
    goTab(doc, 0)
  })

  const nav = doc.createElement("nav")
  nav.className = "wxrun-nav"
  NAV.forEach((item, index) => {
    const a = doc.createElement("a")
    a.className = "wxrun-nav-item"
    a.href = BASE + item.path
    a.textContent = item.label
    a.addEventListener("click", (e) => {
      if (!isPlainClick(e)) return
      e.preventDefault()
      goTab(doc, index)
    })
    nav.append(a)
  })

  const search = doc.createElement("a")
  search.className = "wxrun-search"
  search.href = BASE + SEARCH_PATH
  const hint = doc.createElement("span")
  hint.textContent = "搜索题目"
  const key = doc.createElement("kbd")
  key.textContent = "/"
  search.append(hint, key)

  bar.append(brand, nav, search)

  const crumb = doc.createElement("div")
  crumb.className = "wxrun-crumb"
  const back = doc.createElement("button")
  back.type = "button"
  back.className = "wxrun-back"
  back.textContent = "← 返回"
  back.addEventListener("click", () => {
    doc.querySelector<HTMLElement>(".uni-page-head-btn")?.click()
  })
  const title = doc.createElement("span")
  title.className = "wxrun-crumb-title"
  crumb.append(back, title)

  header.append(bar, crumb)
  return header
}

function update(doc: Document, header: HTMLElement) {
  const { pathname, hash } = doc.defaultView!.location
  const root = doc.documentElement
  const current = activeNav(pathname, hash)
  const sub = !!doc.querySelector(".uni-page-head-btn")

  setAttr(root, "data-wxrun-page", pageKey(pathname, hash))
  setAttr(root, "data-wxrun-sub", sub ? "" : null)

  header.querySelectorAll(".wxrun-nav-item").forEach((a, index) => {
    setAttr(a, "aria-current", index === current ? "page" : null)
  })

  const pageTitle =
    doc.querySelector(".uni-page-head__title")?.textContent?.trim() ?? ""
  setText(header.querySelector(".wxrun-crumb-title")!, pageTitle)

  const onPaper = pageKey(pathname, hash) === PAPER_PAGE
  if (onPaper) mountStudy(doc)
  else unmountStudy(doc)
}

export function mountHeader(doc: Document) {
  if (states.has(doc) || !doc.body) return
  const header = build(doc)
  doc.body.append(header)

  const win = doc.defaultView!
  let scheduled = false
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    win.setTimeout(() => {
      scheduled = false
      if (states.has(doc)) update(doc, header)
    }, 50)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(doc.getElementById("app") ?? doc.body, {
    childList: true,
    subtree: true,
    characterData: true
  })

  const onPopState = schedule
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
    if (isTyping(e.target)) return
    e.preventDefault()
    win.location.assign(BASE + SEARCH_PATH)
  }
  win.addEventListener("popstate", onPopState)
  doc.addEventListener("keydown", onKeyDown)

  states.set(doc, { header, observer, onPopState, onKeyDown })
  update(doc, header)
}

export function unmountHeader(doc: Document) {
  const state = states.get(doc)
  if (!state) return
  states.delete(doc)
  state.observer.disconnect()
  doc.defaultView?.removeEventListener("popstate", state.onPopState)
  doc.removeEventListener("keydown", state.onKeyDown)
  state.header.remove()
  unmountStudy(doc)
  doc.documentElement.removeAttribute("data-wxrun-page")
  doc.documentElement.removeAttribute("data-wxrun-sub")
}

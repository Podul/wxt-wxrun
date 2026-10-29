import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mountHeader, unmountHeader } from "./header"

function setUrl(path: string) {
  window.history.pushState({}, "", path)
}

function renderApp(withBack = false, title = "") {
  let app = document.getElementById("app")
  if (!app) {
    app = document.createElement("div")
    app.id = "app"
    document.body.append(app)
  }
  app.innerHTML = `
      <uni-page-head>
        ${withBack ? '<div class="uni-page-head-btn"></div>' : ""}
        <div class="uni-page-head__title">${title}</div>
      </uni-page-head>
      <uni-tabbar>
        <div class="uni-tabbar__item"></div>
        <div class="uni-tabbar__item"></div>
        <div class="uni-tabbar__item"></div>
        <div class="uni-tabbar__item"></div>
      </uni-tabbar>`
}

beforeEach(() => {
  vi.useFakeTimers()
  setUrl("/mobile/")
  renderApp()
})

afterEach(() => {
  unmountHeader(document)
  vi.useRealTimers()
})

describe("mountHeader", () => {
  it("is idempotent", () => {
    mountHeader(document)
    mountHeader(document)
    expect(document.querySelectorAll("#wxrun-header")).toHaveLength(1)
  })

  it("marks the current nav item and page key", () => {
    setUrl("/mobile/pages/xingce/index")
    mountHeader(document)
    const items = document.querySelectorAll(".wxrun-nav-item")
    expect(items).toHaveLength(4)
    expect(items[1]).toHaveAttribute("aria-current", "page")
    expect(items[0]).not.toHaveAttribute("aria-current")
    expect(document.documentElement).toHaveAttribute(
      "data-wxrun-page",
      "xingce-index"
    )
  })

  it("follows route and title changes in the page", async () => {
    mountHeader(document)
    setUrl("/mobile/pages/paper/list_one")
    renderApp(true, "国考")
    await vi.advanceTimersByTimeAsync(100)
    expect(document.documentElement).toHaveAttribute(
      "data-wxrun-page",
      "paper-list_one"
    )
    expect(document.documentElement).toHaveAttribute("data-wxrun-sub")
    expect(document.querySelector(".wxrun-crumb-title")).toHaveTextContent(
      "国考"
    )
  })
})

describe("navigation", () => {
  it("proxies nav clicks to the site's tabbar", () => {
    mountHeader(document)
    const tabs = document.querySelectorAll<HTMLElement>(".uni-tabbar__item")
    const spy = vi.fn()
    tabs[2]!.addEventListener("click", spy)
    document.querySelectorAll<HTMLElement>(".wxrun-nav-item")[2]!.click()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("proxies the back button to the site's back button", () => {
    renderApp(true, "国考")
    mountHeader(document)
    const spy = vi.fn()
    document.querySelector(".uni-page-head-btn")!.addEventListener("click", spy)
    document.querySelector<HTMLElement>(".wxrun-back")!.click()
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe("unmountHeader", () => {
  it("removes the header and page attributes", () => {
    mountHeader(document)
    unmountHeader(document)
    expect(document.getElementById("wxrun-header")).toBeNull()
    expect(document.documentElement).not.toHaveAttribute("data-wxrun-page")
    unmountHeader(document)
  })
})

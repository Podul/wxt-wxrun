import { describe, expect, it } from "vitest"
import { activeNav, pageKey, routePath } from "./routes"

describe("routePath", () => {
  it("treats the site root as the home page", () => {
    expect(routePath("/mobile/")).toBe("pages/index/index")
    expect(routePath("/mobile")).toBe("pages/index/index")
  })

  it("strips the base path", () => {
    expect(routePath("/mobile/pages/paper/list_one")).toBe(
      "pages/paper/list_one"
    )
  })

  it("prefers hash routes when present", () => {
    expect(routePath("/mobile/", "#/pages/xingce/index?a=1")).toBe(
      "pages/xingce/index"
    )
  })
})

describe("pageKey", () => {
  it("flattens the page path for CSS selectors", () => {
    expect(pageKey("/mobile/pages/paper/list_one")).toBe("paper-list_one")
    expect(pageKey("/mobile/")).toBe("index-index")
    expect(pageKey("/mobile/pages/xingce/index")).toBe("xingce-index")
  })
})

describe("activeNav", () => {
  it("highlights tab pages", () => {
    expect(activeNav("/mobile/")).toBe(0)
    expect(activeNav("/mobile/pages/xingce/index")).toBe(1)
    expect(activeNav("/mobile/pages/paper/paper_collect")).toBe(2)
    expect(activeNav("/mobile/pages/user/user")).toBe(3)
  })

  it("attributes secondary pages to their module", () => {
    expect(activeNav("/mobile/pages/paper/list_one")).toBe(0)
    expect(activeNav("/mobile/pages/user_set/user_set")).toBe(3)
  })

  it("returns -1 for unknown pages", () => {
    expect(activeNav("/mobile/pages/login/login")).toBe(-1)
  })
})

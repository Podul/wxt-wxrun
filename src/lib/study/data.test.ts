import { describe, expect, it } from "vitest"
import {
  dedupeMaterials,
  htmlToText,
  readToken,
  setSafeHtml,
  textToHtml
} from "./data"

describe("dedupeMaterials", () => {
  it("keeps the first copy of repeated material", () => {
    const list = [
      { id: 1, name: "材料一", cailiao: "<p>甲 乙</p>" },
      { id: 2, name: "材料二", cailiao: "<p>丙</p>" },
      { id: 3, name: "材料三", cailiao: "<div>甲乙</div>" }
    ]
    expect(dedupeMaterials(list).map((m) => m.name)).toEqual([
      "材料一",
      "材料二"
    ])
  })
})

describe("setSafeHtml", () => {
  it("drops scripts, event handlers and javascript links", () => {
    const el = document.createElement("div")
    setSafeHtml(
      el,
      '<p onclick="x()">a</p><script>alert(1)</script><a href="javascript:x()">b</a><img src=x onerror="y()">'
    )
    expect(el.querySelector("script")).toBeNull()
    expect(el.querySelector("[onclick]")).toBeNull()
    expect(el.querySelector("[onerror]")).toBeNull()
    expect(el.querySelector("a")).not.toHaveAttribute("href")
    expect(el).toHaveTextContent("ab")
  })
})

describe("token and text helpers", () => {
  it("reads raw and wrapped tokens", () => {
    localStorage.setItem("app_token", "abc")
    expect(readToken(localStorage)).toBe("abc")
    localStorage.setItem(
      "app_token",
      JSON.stringify({ type: "string", data: "xyz" })
    )
    expect(readToken(localStorage)).toBe("xyz")
    localStorage.setItem(
      "app_token",
      JSON.stringify({ expire: 1893456000, value: "site-token" })
    )
    expect(readToken(localStorage)).toBe("site-token")
    localStorage.removeItem("app_token")
    expect(readToken(localStorage)).toBe("")
  })

  it("round-trips paragraphs", () => {
    expect(textToHtml("a<b\n\nc")).toBe("<p>a&lt;b</p><p><br></p><p>c</p>")
    expect(htmlToText("<p>第一段</p><p>第二段</p>")).toBe("第一段\n第二段")
  })
})

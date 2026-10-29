import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { mountStudy, unmountStudy } from "./panel"

const answer = (n: number) => ({
  id: n,
  head: `网友${n}`,
  answer: `<p>答案${n}</p>`,
  score: `${90 - n} Wilson`,
  likeCount: n
})

const paper = {
  info: { name: "测试试卷" },
  lists: [
    {
      id: 11,
      name: "问题一",
      question: "<p>根据“给定资料1”，概括。</p>",
      answer: [answer(1), answer(2)]
    },
    {
      id: 12,
      name: "问题二",
      question: "<p>根据“给定资料2”，分析。</p>",
      answer: [answer(3)]
    }
  ],
  cailiao_list: [
    { id: 1, name: "材料一", cailiao: "<p>甲</p>" },
    { id: 2, name: "材料二", cailiao: "<p>乙</p>" },
    { id: 3, name: "材料三", cailiao: "<p>甲</p>" }
  ]
}

function reply(data: unknown) {
  return Promise.resolve({
    json: () => Promise.resolve({ code: 1, data })
  } as Response)
}

async function mount() {
  mountStudy(document)
  await vi.waitFor(() =>
    expect(document.querySelector(".study-col")).not.toBeNull()
  )
}

beforeEach(() => {
  window.history.pushState({}, "", "/mobile/pages/paper/paper_info?paper_id=9")
  localStorage.setItem("app_token", "tok")
  Element.prototype.scrollIntoView = vi.fn()
  window.open = vi.fn()
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("paper_info")) return reply(paper)
      if (url.includes("query_my_answer")) {
        return reply({ info: [{ answer: "<p>我写的</p>" }, { answer: "" }] })
      }
      return reply({ vip_expire_day: "会员类型：年会员" })
    })
  )
})

afterEach(() => {
  unmountStudy(document)
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("mountStudy", () => {
  it("renders deduped materials on the left and every question on the right", async () => {
    await mount()
    const left = document.querySelector(".study-left")!
    const right = document.querySelector(".study-right")!
    expect(left.querySelectorAll(".study-index-item")).toHaveLength(2)
    expect(left.querySelectorAll(".study-section")).toHaveLength(2)
    expect(right.querySelectorAll(".study-index-item")).toHaveLength(2)
    expect(right.querySelectorAll(".study-section")).toHaveLength(2)
  })

  it("sends the site token with the request", async () => {
    await mount()
    const call = vi.mocked(fetch).mock.calls[0]!
    expect(call[1]).toMatchObject({ headers: { token: "tok" } })
  })

  it("labels the index with the original names", async () => {
    await mount()
    const labels = (side: string) =>
      [...document.querySelectorAll(`.${side} .study-index-item`)].map(
        (b) => b.textContent
      )
    expect(labels("study-left")).toEqual(["材料一", "材料二"])
    expect(labels("study-right")).toEqual(["问题一", "问题二"])
    expect(document.querySelector(".study-ref")).toBeNull()
  })

  it("jumps via the index", async () => {
    await mount()
    const spy = vi.mocked(Element.prototype.scrollIntoView)
    spy.mockClear()
    document
      .querySelectorAll<HTMLElement>(".study-right .study-index-item")[1]!
      .click()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("lists other people's answers and prefills my own", async () => {
    await mount()
    const sections = document.querySelectorAll(".study-right .study-section")
    expect(sections[0]!.querySelectorAll(".study-other")).toHaveLength(2)
    expect(
      sections[0]!.querySelector(".study-other summary")
    ).toHaveTextContent("网友1 · 89 Wilson · 👍1")
    expect(
      sections[0]!.querySelector<HTMLTextAreaElement>("textarea")!.value
    ).toBe("我写的")
    expect(
      sections[1]!.querySelector<HTMLTextAreaElement>("textarea")!.value
    ).toBe("")
  })

  it("hands the answer to the site's grading page", async () => {
    await mount()
    const section = document.querySelectorAll<HTMLElement>(
      ".study-right .study-section"
    )[0]!
    const buttons = section.querySelectorAll<HTMLElement>(".study-btn")
    buttons[0]!.click()
    expect(window.open).toHaveBeenCalledWith(
      "/mobile/pages/paper/pigai?is_vip=1&type=1",
      "_blank"
    )
    const stored = JSON.parse(localStorage.getItem("compare_array")!)
    expect(stored.type).toBe("object")
    expect(stored.data).toMatchObject({
      one_answer: "<p>我写的</p>",
      two_answer_head: "网友1",
      question_id: 11
    })
  })

  it("asks for an answer before grading", async () => {
    await mount()
    const section = document.querySelectorAll<HTMLElement>(
      ".study-right .study-section"
    )[1]!
    section.querySelectorAll<HTMLElement>(".study-btn")[0]!.click()
    expect(window.open).not.toHaveBeenCalled()
    expect(document.querySelector(".study-toast")).toHaveTextContent(
      "请先写答案"
    )
  })

  it("counts characters while typing", async () => {
    await mount()
    const section = document.querySelectorAll(".study-right .study-section")[1]!
    const box = section.querySelector<HTMLTextAreaElement>("textarea")!
    box.value = "一 二 三"
    box.dispatchEvent(new Event("input"))
    expect(section.querySelector(".study-count")).toHaveTextContent("共 3 个字")
  })

  it("removes itself on unmount", async () => {
    await mount()
    unmountStudy(document)
    expect(document.getElementById("wxrun-study")).toBeNull()
  })

  it("shows the error when loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ code: 0, msg: "未登录" })
        })
      )
    )
    mountStudy(document)
    await vi.waitFor(() =>
      expect(document.querySelector(".study-body")).toHaveTextContent(
        "加载失败：未登录"
      )
    )
  })
})

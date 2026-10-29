export const API = "https://like.wxrun.com/api/"

export type Answer = {
  id: number
  head: string
  answer: string
  score: string
  likeCount: number
}

export type Question = {
  id: number
  name: string
  question: string
  answer: Answer[]
}

export type Material = { id: number; name: string; cailiao: string }

export type Paper = {
  name: string
  questions: Question[]
  materials: Material[]
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
}

/** 有的试卷会把材料整段重复一遍，按正文去重，保留第一次出现的。 */
export function dedupeMaterials(list: Material[]): Material[] {
  const seen = new Set<string>()
  return list.filter((m) => {
    const key = stripHtml(m.cailiao).replace(/\s+/g, "")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const DROP = "script,style,iframe,object,embed,link,meta,form"

/** 站点接口返回的 HTML 写入页面前去掉脚本、事件属性和 javascript: 链接。 */
export function setSafeHtml(el: Element, html: string) {
  const tpl = el.ownerDocument.createElement("template")
  tpl.innerHTML = html
  tpl.content.querySelectorAll(DROP).forEach((node) => node.remove())
  tpl.content.querySelectorAll("*").forEach((node) => {
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim().toLowerCase()
      if (
        name.startsWith("on") ||
        ((name === "href" || name === "src") && value.startsWith("javascript:"))
      ) {
        node.removeAttribute(attr.name)
      }
    }
  })
  el.replaceChildren(tpl.content)
}

/** uni-app 的 token 存成裸字符串；兼容 {type, data} 包装。 */
export function readToken(storage: Storage): string {
  const raw = storage.getItem("app_token") ?? ""
  try {
    const value = JSON.parse(raw)
    if (typeof value === "string") return value
    if (value && typeof value.data === "string") return value.data
  } catch {
    // 裸字符串
  }
  return raw
}

export function textToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return text
    .split("\n")
    .map((line) => `<p>${esc(line) || "<br>"}</p>`)
    .join("")
}

export function htmlToText(html: string): string {
  return stripHtml(html.replace(/<\/p>\s*/g, "\n").replace(/<br\s*\/?>/g, "\n"))
    .replace(/\n+$/, "")
    .trim()
}

async function call<T>(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { token, ...(init.headers ?? {}) }
  })
  const json = await res.json()
  if (json.code !== 1) throw new Error(json.msg || "请求失败")
  return json.data as T
}

export async function loadPaper(
  paperId: string,
  token: string
): Promise<Paper> {
  const data = await call<{
    info: { name: string }
    lists: Question[]
    cailiao_list: Material[]
  }>(`shenlun/paper_info?paper_id=${encodeURIComponent(paperId)}`, token)
  return {
    name: data.info.name,
    questions: data.lists,
    materials: dedupeMaterials(data.cailiao_list ?? [])
  }
}

/** 站点上保存的“我的答案”，按题目顺序，失败时返回空数组。 */
export async function loadMyAnswers(
  paperId: string,
  token: string
): Promise<string[]> {
  try {
    const data = await call<{ info: { answer: string }[] }>(
      "shenlun/query_my_answer",
      token,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paper_id: paperId })
      }
    )
    return data.info.map((item) => htmlToText(item.answer ?? ""))
  } catch {
    return []
  }
}

export async function loadIsVip(token: string): Promise<boolean> {
  try {
    const data = await call<{ vip_expire_day?: string }>("user/center", token)
    return /会员类型/.test(data.vip_expire_day ?? "")
  } catch {
    return false
  }
}

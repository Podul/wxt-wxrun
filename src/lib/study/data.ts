export const API = "https://like.wxrun.com/api/"

export type Answer = {
  id: number
  head: string
  answer: string
  score: string
  likeCount: number
  is_free?: boolean
}

export type Question = {
  id: number
  name: string
  question: string
  answer: Answer[]
}

export type Material = { id: number; name: string; cailiao: string }

export type Paper = {
  id: number
  name: string
  isCollect: boolean
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

/** 站点把 token 存成 {expire, value}；兼容 {type, data} 包装和裸字符串。 */
export function readToken(storage: Storage): string {
  const raw = storage.getItem("app_token") ?? ""
  try {
    const value = JSON.parse(raw)
    if (typeof value === "string") return value
    if (value && typeof value.value === "string") return value.value
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
    info: { id: number; name: string; is_collect?: boolean }
    lists: Question[]
    cailiao_list: Material[]
  }>(`shenlun/paper_info?paper_id=${encodeURIComponent(paperId)}`, token)
  return {
    id: data.info.id,
    name: data.info.name,
    isCollect: !!data.info.is_collect,
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

export type User = { id: number; isVip: boolean }

export async function loadUser(token: string): Promise<User> {
  try {
    const data = await call<{ id?: number; vip_expire_day?: string }>(
      "user/center",
      token
    )
    return {
      id: data.id ?? 0,
      isVip: /会员类型/.test(data.vip_expire_day ?? "")
    }
  } catch {
    return { id: 0, isVip: false }
  }
}

function post<T>(path: string, token: string, body: unknown) {
  return call<T>(path, token, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  })
}

/** 保存到站点“我的答案”，answer 是 HTML。 */
export function saveMyAnswer(
  token: string,
  paperId: string,
  questionId: number,
  answer: string
) {
  return post("shenlun/add_my_answer", token, {
    paper_id: paperId,
    question_id: questionId,
    answer
  })
}

export type PigaiRecord = {
  date: string
  type: string
  question: string
  result: string
}

export async function loadPigaiHistory(
  token: string,
  questionId: number
): Promise<PigaiRecord[]> {
  const data = await post<{ list?: PigaiRecord[] }>(
    "shenlun/query_pigai_history",
    token,
    { id: questionId }
  )
  return data.list ?? []
}

/** 智能对比：先提交，再打开站点的 ai 结果页。 */
export function addAiCompare(
  token: string,
  body: {
    paper_id: string
    question_id: number
    my_answer: string
    two_answer: string
    two_answer_head: string
  }
) {
  return post("shenlun/add_ai", token, { ...body, type: 2 })
}

export type Comment = {
  id?: number
  nickname: string
  content: string
  add_time: string
  avatar?: string
}

export async function loadComments(
  token: string,
  questionId: number
): Promise<Comment[]> {
  const data = await call<{ lists?: Comment[] }>(
    `shenlun/get_comment_list?question_id=${questionId}`,
    token
  )
  return data.lists ?? []
}

export function addComment(
  token: string,
  body: {
    content: string
    paper_id: string
    question_id: number
    add_time: string
  }
) {
  return post("shenlun/add_comment", token, body)
}

export function setCollect(token: string, paperId: number, on: boolean) {
  return post(
    on ? "shenlun/addCollectPaper" : "shenlun/cancelCollectPaper",
    token,
    { id: paperId }
  )
}

/** 上传图片后交给站点的 OCR 接口，返回识别出的文字。 */
export async function ocrImage(token: string, file: File): Promise<string> {
  const form = new FormData()
  form.append("file", file)
  const uploaded = await call<{ uri: string }>("upload/image", token, {
    method: "POST",
    body: form
  })
  const data = await post<{ info: string }>("api/ocr", token, {
    image_url: uploaded.uri
  })
  return data.info
}

/** 复制用的纯文本：段落前加全角缩进，与站点一致。 */
export function toCopyText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|ul|ol|li|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `　　${line}`)
    .join("\n")
}

export function nowString(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

import { BASE } from "@/lib/layout/routes"
import {
  addAiCompare,
  addComment,
  loadComments,
  loadMyAnswers,
  loadPaper,
  loadPigaiHistory,
  loadUser,
  nowString,
  ocrImage,
  readToken,
  saveMyAnswer,
  setCollect,
  setSafeHtml,
  textToHtml,
  toCopyText,
  type Paper,
  type Question
} from "./data"
import { openDialog } from "./dialog"
import { createInk, type Ink, type Tool } from "./ink"
import {
  debounce,
  fontItem,
  loadState,
  saveState,
  splitItem,
  type PaperState
} from "./store"

const PANEL_ID = "wxrun-study"
const SPLIT_MIN = 25
const SPLIT_MAX = 75
const FONT_MIN = 13
const FONT_MAX = 22
const COPY_SUFFIX = "（复制自申论猫小程序：#小程序://申论猫/jasYGV64ZogRy2y）"

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: "pen", label: "画笔" },
  { tool: "circle", label: "圈" },
  { tool: "mark", label: "荧光" },
  { tool: "move", label: "移动" },
  { tool: "erase", label: "橡皮" }
]

type State = { root: HTMLElement; cleanup: () => void }

const states = new WeakMap<Document, State>()

function h<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className = "",
  text = ""
) {
  const node = doc.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function button(doc: Document, className: string, text: string) {
  const node = h(doc, "button", className, text)
  node.type = "button"
  return node
}

function paperId(win: Window): string {
  const { search, hash } = win.location
  const query =
    search || (hash.includes("?") ? hash.slice(hash.indexOf("?")) : "")
  return new URLSearchParams(query).get("paper_id") ?? ""
}

function countChars(text: string) {
  return text.replace(/\s/g, "").length
}

/** 一栏：顶部索引 + 可独立滚动的内容区。 */
function column(doc: Document, className: string) {
  const root = h(doc, "section", `study-col ${className}`)
  const index = h(doc, "nav", "study-index")
  const scroll = h(doc, "div", "study-scroll")
  root.append(index, scroll)

  const items: { button: HTMLElement; section: HTMLElement }[] = []
  const mark = () => {
    const top = scroll.getBoundingClientRect().top
    let current = 0
    items.forEach(({ section }, i) => {
      if (section.getBoundingClientRect().top - top <= 8) current = i
    })
    items.forEach(({ button: b }, i) => {
      if (i === current) b.setAttribute("aria-current", "true")
      else b.removeAttribute("aria-current")
    })
  }
  scroll.addEventListener("scroll", mark)

  return {
    root,
    index,
    scroll,
    add(label: string, section: HTMLElement) {
      const b = button(doc, "study-index-item", label)
      b.addEventListener("click", () =>
        section.scrollIntoView({ block: "start", behavior: "smooth" })
      )
      index.append(b)
      scroll.append(section)
      items.push({ button: b, section })
      mark()
    },
    mark
  }
}

type MaterialDeps = {
  isVip: boolean
  save: () => void
  toast: (message: string) => void
}

async function copyText(
  doc: Document,
  text: string,
  toast: (m: string) => void
) {
  try {
    await doc.defaultView!.navigator.clipboard.writeText(text)
    toast("复制成功")
  } catch {
    toast("复制失败")
  }
}

function buildMaterials(
  doc: Document,
  paper: Paper,
  state: PaperState,
  deps: MaterialDeps
) {
  const { save } = deps
  const col = column(doc, "study-left")
  const inks: Ink[] = []
  const sections: HTMLElement[] = []

  const tools = h(doc, "div", "study-tools")
  const toolButtons = new Map<Tool, HTMLElement>()
  let active: Tool = "none"
  const choose = (tool: Tool) => {
    active = active === tool ? "none" : tool
    inks.forEach((ink) => ink.setTool(active))
    toolButtons.forEach((b, t) =>
      b.setAttribute("aria-pressed", String(t === active))
    )
  }
  for (const { tool, label } of TOOLS) {
    const b = button(doc, "study-tool", label)
    b.setAttribute("aria-pressed", "false")
    b.addEventListener("click", () => choose(tool))
    toolButtons.set(tool, b)
    tools.append(b)
  }
  const clear = button(doc, "study-tool", "清空本段")
  const copy = button(doc, "study-tool", "复制材料")
  tools.append(clear, copy)
  col.root.insertBefore(tools, col.scroll)

  const visible = () => {
    const top = col.scroll.getBoundingClientRect().top
    let current = sections[0]
    for (const s of sections) {
      if (s.getBoundingClientRect().top - top <= 8) current = s
    }
    return current
  }
  const clearers = new Map<HTMLElement, () => void>()
  clear.addEventListener("click", () => {
    const section = visible()
    if (section) clearers.get(section)?.()
  })

  copy.addEventListener("click", () => {
    if (!deps.isVip) return deps.toast("会员专属权益")
    const current = visible()
    const material = paper.materials[sections.indexOf(current!)]
    if (!material) return
    void copyText(
      doc,
      `${toCopyText(material.cailiao)}\n${COPY_SUFFIX}`,
      deps.toast
    )
  })

  if (!paper.materials.length) {
    col.scroll.append(
      h(doc, "p", "study-empty", "材料未收集到，收集到后将在第一时间上传。")
    )
  }

  paper.materials.forEach((material) => {
    const section = h(doc, "article", "study-section")
    section.id = `study-m-${material.id}`
    section.append(h(doc, "h3", "", material.name))
    const host = h(doc, "div", "study-ink-host")
    const text = h(doc, "div", "study-text")
    setSafeHtml(text, material.cailiao)
    host.append(text)
    section.append(host)

    const key = String(material.id)
    const ink = createInk(host, state.ink[key] ?? [], (shapes) => {
      state.ink[key] = shapes
      save()
    })
    ink.setTool(active)
    inks.push(ink)
    clearers.set(section, () => ink.clear())
    sections.push(section)
    col.add(material.name, section)
  })

  return {
    root: col.root,
    sections,
    mark: col.mark,
    destroy: () => inks.forEach((ink) => ink.destroy())
  }
}

type QuestionDeps = {
  doc: Document
  root: HTMLElement
  state: PaperState
  myAnswers: string[]
  isVip: boolean
  userId: number
  token: string
  paperId: string
  save: () => void
  toast: (message: string) => void
}

function fail(toast: (m: string) => void, error: unknown) {
  toast((error as Error).message || "请求失败")
}

function openHistory(q: Question, deps: QuestionDeps) {
  const { doc } = deps
  const dialog = openDialog(deps.root, `${q.name} · 批改历史`)
  dialog.body.textContent = "加载中…"
  loadPigaiHistory(deps.token, q.id).then(
    (list) => {
      if (!list.length) {
        dialog.body.replaceChildren(h(doc, "p", "study-empty", "暂无批改记录"))
        return
      }
      dialog.body.replaceChildren(
        ...list.map((item) => {
          const entry = h(doc, "article", "study-history")
          const meta = h(doc, "div", "study-history-meta")
          meta.append(
            h(doc, "span", "study-tag", item.date),
            h(doc, "span", "study-tag study-tag-ok", item.type)
          )
          const question = h(doc, "div", "study-text")
          setSafeHtml(question, item.question)
          const result = h(doc, "div", "study-text")
          setSafeHtml(result, item.result)
          entry.append(
            meta,
            h(doc, "h4", "", "题目"),
            question,
            h(doc, "h4", "", "批改"),
            result
          )
          return entry
        })
      )
    },
    (error) => {
      dialog.body.textContent = `加载失败：${(error as Error).message}`
    }
  )
}

function openComments(q: Question, deps: QuestionDeps) {
  const { doc } = deps
  const dialog = openDialog(deps.root, `${q.name} · 评论`)
  const list = h(doc, "div", "study-comments")
  list.textContent = "加载中…"
  const input = h(doc, "input", "study-comment-input")
  input.placeholder = "说点什么..."
  const send = button(doc, "study-btn", "发送")
  const row = h(doc, "div", "study-comment-row")
  row.append(input, send)
  dialog.body.append(list, row)

  const item = (c: { nickname: string; content: string; add_time: string }) => {
    const node = h(doc, "div", "study-comment")
    node.append(
      h(doc, "div", "study-comment-meta", `${c.nickname} · ${c.add_time}`),
      h(doc, "div", "", c.content)
    )
    return node
  }
  const empty = () => h(doc, "p", "study-empty", "暂无评论，快来抢沙发～")

  loadComments(deps.token, q.id).then(
    (comments) => {
      list.replaceChildren(
        ...(comments.length ? comments.map(item) : [empty()])
      )
    },
    (error) => {
      list.textContent = `加载失败：${(error as Error).message}`
    }
  )

  const submit = async () => {
    const content = input.value.trim()
    if (!content) return
    const add_time = nowString()
    try {
      await addComment(deps.token, {
        content,
        paper_id: deps.paperId,
        question_id: q.id,
        add_time
      })
    } catch (error) {
      return fail(deps.toast, error)
    }
    list.querySelector(".study-empty")?.remove()
    list.prepend(item({ nickname: "我", content, add_time }))
    input.value = ""
  }
  send.addEventListener("click", () => void submit())
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) void submit()
  })
}

function buildQuestion(q: Question, index: number, deps: QuestionDeps) {
  const { doc, state } = deps
  const win = doc.defaultView!
  const section = h(doc, "article", "study-section")
  section.id = `study-q-${q.id}`

  const head = h(doc, "div", "study-q-head")
  head.append(h(doc, "h3", "", q.name))
  const body = h(doc, "div", "study-text")
  setSafeHtml(body, q.question)

  const draftKey = String(q.id)
  const answer = h(doc, "textarea", "study-answer")
  answer.placeholder = "在这里写答案…"
  answer.value = state.drafts[draftKey] ?? deps.myAnswers[index] ?? ""
  const count = h(doc, "span", "study-count")
  const refresh = () => {
    count.textContent = `共 ${countChars(answer.value)} 个字`
  }
  refresh()
  answer.addEventListener("input", () => {
    state.drafts[draftKey] = answer.value
    refresh()
    deps.save()
  })

  const open = (path: string) => win.open(BASE + path, "_blank")
  /** 要求已写答案；返回答案文本，没写则提示并返回 null。 */
  const mine = () => {
    const text = answer.value.trim()
    if (!text) deps.toast("请先写答案")
    return text || null
  }
  // 与站点自己的按钮写入同样的 compare_array，再打开对应页面
  const stash = (text: string) => {
    const other = q.answer[0]
    win.localStorage.setItem(
      "compare_array",
      JSON.stringify({
        type: "object",
        data: {
          one_answer: textToHtml(text),
          two_answer: other?.answer ?? "",
          two_answer_head: other?.head ?? "",
          question: q.question,
          question_id: q.id
        }
      })
    )
  }
  const vip = deps.isVip ? 1 : 0

  const grade = (type: 1 | 2) => {
    const text = mine()
    if (!text) return
    if (type === 2 && !deps.isVip) return deps.toast("智能批改是会员专属")
    stash(text)
    open(`pages/paper/pigai?is_vip=${vip}&type=${type}`)
  }
  const normal = button(doc, "study-btn", "普通批改")
  normal.addEventListener("click", () => grade(1))
  const smart = button(doc, "study-btn", "智能批改")
  smart.addEventListener("click", () => grade(2))

  const compare = button(doc, "study-btn", "对比")
  compare.addEventListener("click", () => {
    const text = mine()
    if (!text) return
    stash(text)
    open(`pages/paper/compare?is_vip=${vip}`)
  })
  const smartCompare = button(doc, "study-btn", "智能对比")
  smartCompare.addEventListener("click", async () => {
    const text = mine()
    if (!text) return
    const other = q.answer[0]
    try {
      await addAiCompare(deps.token, {
        paper_id: deps.paperId,
        question_id: q.id,
        my_answer: textToHtml(text),
        two_answer: other?.answer ?? "",
        two_answer_head: other?.head ?? ""
      })
    } catch (error) {
      return fail(deps.toast, error)
    }
    open(`pages/paper/ai?user_id=${deps.userId}`)
  })
  const history = button(doc, "study-btn", "批改历史")
  history.addEventListener("click", () => openHistory(q, deps))

  const actions = h(doc, "div", "study-actions")
  actions.append(count, normal, smart, compare, smartCompare, history)

  const save = button(doc, "study-link", "保存到站点")
  save.addEventListener("click", async () => {
    const text = mine()
    if (!text) return
    try {
      await saveMyAnswer(deps.token, deps.paperId, q.id, textToHtml(text))
      deps.toast("保存成功")
    } catch (error) {
      fail(deps.toast, error)
    }
  })
  const file = h(doc, "input", "study-file")
  file.type = "file"
  file.accept = "image/*"
  file.hidden = true
  const scan = button(doc, "study-link", "拍照识别")
  scan.addEventListener("click", () => file.click())
  file.addEventListener("change", async () => {
    const picked = file.files?.[0]
    file.value = ""
    if (!picked) return
    deps.toast("图片识别中…")
    try {
      const text = await ocrImage(deps.token, picked)
      answer.value = [answer.value.trimEnd(), text].filter(Boolean).join("\n")
      answer.dispatchEvent(new Event("input"))
      deps.toast("识别完成")
    } catch (error) {
      fail(deps.toast, error)
    }
  })
  const copy = button(doc, "study-link", "复制题目")
  copy.addEventListener("click", () => {
    if (!deps.isVip) return deps.toast("会员专属权益")
    void copyText(doc, toCopyText(q.question), deps.toast)
  })
  const comments = button(doc, "study-link", "评论")
  comments.addEventListener("click", () => openComments(q, deps))
  const extras = h(doc, "div", "study-extras")
  extras.append(save, scan, file, copy, comments)

  const others = h(doc, "div", "study-others")
  const othersHead = h(doc, "div", "study-others-head")
  const supplement = button(doc, "study-link", "补充答案")
  supplement.addEventListener("click", () =>
    open(`pages/paper/answer?paper_id=${deps.paperId}&current_tab=${index}`)
  )
  othersHead.append(
    h(doc, "h4", "", `网友答案（${q.answer.length}）`),
    supplement
  )
  others.append(othersHead)
  for (const a of q.answer) {
    const item = h(doc, "details", "study-other")
    const summary = h(doc, "summary", "")
    const locked = a.is_free === false && !deps.isVip
    const label = `${locked ? "🔒 " : ""}${a.head} · ${a.score} · 👍${a.likeCount}`
    summary.textContent = label
    const pin = button(doc, "study-link", "置顶")
    pin.addEventListener("click", () => {
      const pinned = item.dataset.pinned === "true"
      if (pinned) {
        delete item.dataset.pinned
        summary.textContent = label
        pin.textContent = "置顶"
        return deps.toast("取消置顶成功")
      }
      item.dataset.pinned = "true"
      summary.textContent = `📌 ${label}`
      pin.textContent = "取消置顶"
      othersHead.after(item)
      deps.toast("置顶成功")
    })
    const content = h(doc, "div", "study-other-body")
    setSafeHtml(content, a.answer)
    item.append(summary, pin, content)
    others.append(item)
  }

  section.append(head, body, answer, actions, extras, others)
  return section
}

function buildBar(
  doc: Document,
  bar: HTMLElement,
  root: HTMLElement,
  paper: Paper,
  ctx: { token: string; paperId: string; isVip: boolean; font: number },
  toast: (message: string) => void
) {
  const win = doc.defaultView!
  const title = h(doc, "span", "study-bar-title", paper.name)

  let font = ctx.font
  const setFont = (value: number) => {
    font = Math.min(FONT_MAX, Math.max(FONT_MIN, value))
    root.style.setProperty("--study-font", `${font}px`)
    void fontItem.setValue(font)
  }
  setFont(font)
  const smaller = button(doc, "study-tool", "A-")
  smaller.title = "缩小字号"
  smaller.addEventListener("click", () => setFont(font - 1))
  const larger = button(doc, "study-tool", "A+")
  larger.title = "放大字号"
  larger.addEventListener("click", () => setFont(font + 1))

  let collected = paper.isCollect
  const collect = button(doc, "study-tool", "")
  const paintCollect = () => {
    collect.textContent = collected ? "取消收藏" : "收藏试卷"
  }
  paintCollect()
  collect.addEventListener("click", async () => {
    try {
      await setCollect(ctx.token, paper.id, !collected)
    } catch (error) {
      return fail(toast, error)
    }
    collected = !collected
    paintCollect()
    toast(collected ? "收藏成功！" : "已取消收藏")
  })

  const download = button(doc, "study-tool", "下载试卷")
  download.addEventListener("click", () =>
    win.open(
      `${BASE}pages/paper/download?paper_id=${ctx.paperId}&is_vip=${ctx.isVip ? 1 : 0}`,
      "_blank"
    )
  )

  bar.append(title, smaller, larger, collect, download)
  bar.hidden = false
}

function buildQuestions(doc: Document, paper: Paper, deps: QuestionDeps) {
  const col = column(doc, "study-right")
  const sections = paper.questions.map((q, i) => {
    const section = buildQuestion(q, i, deps)
    col.add(q.name, section)
    return section
  })
  return { root: col.root, sections, mark: col.mark }
}

function buildShell(doc: Document) {
  const root = h(doc, "div", "")
  root.id = PANEL_ID
  const bar = h(doc, "div", "study-bar")
  bar.hidden = true
  const body = h(doc, "div", "study-body")
  const toast = h(doc, "div", "study-toast")
  toast.hidden = true
  root.append(bar, body, toast)
  return { root, bar, body, toast }
}

export function mountStudy(doc: Document) {
  if (states.has(doc) || !doc.body) return
  const win = doc.defaultView!
  const shell = buildShell(doc)
  const loading = h(doc, "div", "study-loading")
  loading.setAttribute("role", "status")
  loading.append(h(doc, "span", "study-spinner"), h(doc, "span", "", "加载中…"))
  shell.body.append(loading)
  doc.body.append(shell.root)

  let timer: ReturnType<typeof setTimeout> | undefined
  const toast = (message: string) => {
    shell.toast.textContent = message
    shell.toast.hidden = false
    clearTimeout(timer)
    timer = setTimeout(() => (shell.toast.hidden = true), 2000)
  }

  let disposers: (() => void)[] = []

  const state: State = {
    root: shell.root,
    cleanup() {
      clearTimeout(timer)
      disposers.forEach((fn) => fn())
    }
  }
  states.set(doc, state)

  void (async () => {
    const id = paperId(win)
    const token = readToken(win.localStorage)
    try {
      const [paper, myAnswers, user, saved, split, font] = await Promise.all([
        loadPaper(id, token),
        loadMyAnswers(id, token),
        loadUser(token),
        loadState(id),
        splitItem.getValue(),
        fontItem.getValue()
      ])
      const { isVip } = user
      if (states.get(doc) !== state) return

      const persisted = debounce(() => void saveState(id, saved), 400)
      buildBar(
        doc,
        shell.bar,
        shell.root,
        paper,
        { token, paperId: id, isVip, font },
        toast
      )
      const left = buildMaterials(doc, paper, saved, {
        isVip,
        save: persisted,
        toast
      })
      const right = buildQuestions(doc, paper, {
        doc,
        root: shell.root,
        state: saved,
        myAnswers,
        isVip,
        userId: user.id,
        token,
        paperId: id,
        save: persisted,
        toast
      })

      const handle = button(doc, "study-split", "")
      handle.setAttribute("role", "separator")
      handle.setAttribute("aria-orientation", "vertical")
      const setSplit = (value: number) => {
        const clamped = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value))
        shell.body.style.setProperty("--study-left", `${clamped}%`)
        return clamped
      }
      setSplit(split)
      handle.addEventListener("pointerdown", (e) => {
        e.preventDefault()
        handle.setPointerCapture?.(e.pointerId)
        const rect = shell.body.getBoundingClientRect()
        const move = (ev: PointerEvent) =>
          setSplit(((ev.clientX - rect.left) / (rect.width || 1)) * 100)
        const up = (ev: PointerEvent) => {
          handle.removeEventListener("pointermove", move)
          handle.removeEventListener("pointerup", up)
          void splitItem.setValue(
            setSplit(((ev.clientX - rect.left) / (rect.width || 1)) * 100)
          )
        }
        handle.addEventListener("pointermove", move)
        handle.addEventListener("pointerup", up)
      })

      shell.body.replaceChildren(left.root, handle, right.root)
      left.mark()
      right.mark()
      disposers = [left.destroy, () => void saveState(id, saved)]
    } catch (error) {
      shell.body.textContent = `加载失败：${(error as Error).message}`
    }
  })()
}

export function unmountStudy(doc: Document) {
  const state = states.get(doc)
  if (!state) return
  states.delete(doc)
  state.cleanup()
  state.root.remove()
}

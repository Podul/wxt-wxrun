import { BASE } from "@/lib/layout/routes"
import {
  loadIsVip,
  loadMyAnswers,
  loadPaper,
  readToken,
  setSafeHtml,
  textToHtml,
  type Paper,
  type Question
} from "./data"
import { createInk, type Ink, type Tool } from "./ink"
import {
  debounce,
  loadState,
  saveState,
  splitItem,
  type PaperState
} from "./store"

const PANEL_ID = "wxrun-study"
const SPLIT_MIN = 25
const SPLIT_MAX = 75

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

function buildMaterials(
  doc: Document,
  paper: Paper,
  state: PaperState,
  save: () => void
) {
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
  tools.append(clear)
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
  state: PaperState
  myAnswers: string[]
  isVip: boolean
  save: () => void
  toast: (message: string) => void
}

function buildQuestion(q: Question, index: number, deps: QuestionDeps) {
  const { doc, state } = deps
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

  const actions = h(doc, "div", "study-actions")
  const grade = (type: 1 | 2) => {
    const mine = answer.value.trim()
    if (!mine) return deps.toast("请先写答案")
    if (type === 2 && !deps.isVip) return deps.toast("智能批改是会员专属")
    const other = q.answer[0]
    // 与站点自己的“批改”按钮写入同样的 compare_array，再打开批改页
    doc.defaultView!.localStorage.setItem(
      "compare_array",
      JSON.stringify({
        type: "object",
        data: {
          one_answer: textToHtml(mine),
          two_answer: other?.answer ?? "",
          two_answer_head: other?.head ?? "",
          question: q.question,
          question_id: q.id
        }
      })
    )
    doc.defaultView!.open(
      `${BASE}pages/paper/pigai?is_vip=${deps.isVip ? 1 : 0}&type=${type}`,
      "_blank"
    )
  }
  const normal = button(doc, "study-btn", "普通批改")
  normal.addEventListener("click", () => grade(1))
  const smart = button(doc, "study-btn", "智能批改")
  smart.addEventListener("click", () => grade(2))
  actions.append(count, normal, smart)

  const others = h(doc, "div", "study-others")
  others.append(h(doc, "h4", "", `网友答案（${q.answer.length}）`))
  for (const a of q.answer) {
    const item = h(doc, "details", "study-other")
    const summary = h(doc, "summary", "")
    summary.textContent = `${a.head} · ${a.score} · 👍${a.likeCount}`
    const content = h(doc, "div", "study-other-body")
    setSafeHtml(content, a.answer)
    item.append(summary, content)
    others.append(item)
  }

  section.append(head, body, answer, actions, others)
  return section
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
  const body = h(doc, "div", "study-body")
  const toast = h(doc, "div", "study-toast")
  toast.hidden = true
  root.append(body, toast)
  return { root, body, toast }
}

export function mountStudy(doc: Document) {
  if (states.has(doc) || !doc.body) return
  const win = doc.defaultView!
  const shell = buildShell(doc)
  shell.body.textContent = "加载中…"
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
      const [paper, myAnswers, isVip, saved, split] = await Promise.all([
        loadPaper(id, token),
        loadMyAnswers(id, token),
        loadIsVip(token),
        loadState(id),
        splitItem.getValue()
      ])
      if (states.get(doc) !== state) return

      const persisted = debounce(() => void saveState(id, saved), 400)
      const left = buildMaterials(doc, paper, saved, persisted)
      const right = buildQuestions(doc, paper, {
        doc,
        state: saved,
        myAnswers,
        isVip,
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

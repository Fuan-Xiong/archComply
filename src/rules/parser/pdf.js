// src/rules/parser/pdf.js —— pdf 解析（pdfjs-dist 文本抽取）
// 产出：裸块列表，page 必填（1-based），带 bbox（PDF 用户空间坐标，y 向上）。
// extractPdfBlocks / textItemsToBlocks 是纯逻辑，doc 可注入假对象，便于 node:test 确定性测试。

import { getDocument } from 'pdfjs-dist'

/**
 * 解析 pdf buffer → 裸块列表。
 * @param {{buffer:Buffer}} input
 * @returns {Promise<Array<{type:string, heading:string|null, page:number, text:string, bbox:object}>>}
 */
export async function parsePdfBlocks({ buffer }) {
  if (!buffer || buffer.length === 0) throw new Error('pdf 解析失败：buffer 为空')
  let doc
  try {
    const task = getDocument({ data: new Uint8Array(buffer), useSystemFonts: true })
    doc = await task.promise
  } catch (err) {
    throw new Error(`pdf 加载失败（pdfjs-dist）: ${err.message}`)
  }
  try {
    return await extractPdfBlocks(doc)
  } finally {
    await doc.destroy().catch(() => {})
  }
}

/**
 * 按页抽取文本项 → 行 → 块。doc 只需提供 numPages 与 getPage(n)（返回
 * { getTextContent() → { items } }），这样单测可注入假 PDF。
 *
 * @param {{numPages:number, getPage:(n:number)=>Promise<object>}} doc
 * @returns {Promise<Array<{type:string, heading:null, page:number, text:string, bbox:object}>>}
 */
export async function extractPdfBlocks(doc) {
  const blocks = []
  const { numPages } = doc
  for (let pageNo = 1; pageNo <= numPages; pageNo += 1) {
    const page = await doc.getPage(pageNo)
    const content = await page.getTextContent()
    blocks.push(...textItemsToBlocks(content.items ?? [], pageNo))
  }
  if (blocks.length === 0) throw new Error('pdf 未提取到任何文本')
  return blocks
}

/** 列表项行首模式：项目符号 / 数字序号 / 括号数字 */
const BULLET_RE = /^[•·▪●○■□◆*]\s*|^\d+[.、)）]\s*|^[（(]\s*\d+\s*[）)]\s*/

/**
 * 纯函数：pdfjs 文本项 → 块。
 * 分组规则：
 * - 文本项按 hasEOL 分成"行"；同行的项之间水平空隙超过约 0.3 字符宽时补一个空格。
 * - 行再按以下条件断成"块"：空白行 / 行间垂直间隙 > 0.55 行高 / 大字号（标题） / 列表项行首。
 * - 相邻行文本拼接时，若接缝处任一侧是汉字则不补空格，否则补一个空格。
 *
 * @param {Array<{str:string, transform?:number[], width?:number, height?:number, hasEOL?:boolean}>} items
 * @param {number} page 1-based 页码
 * @returns {Array<{type:string, heading:null, page:number, text:string, bbox:{x0:number,top:number,x1:number,bottom:number}}>}
 */
export function textItemsToBlocks(items, page) {
  const clean = (items ?? []).filter((it) => it.str && it.str.trim().length > 0)
  const heights = clean.map((it) => Number(it.height) || 0).filter((h) => h > 0)
  const median = medianOf(heights)
  const lines = buildLines(clean)

  const blocks = []
  let cur = null
  let prevLine = null
  for (const line of lines) {
    const text = line.text.trim()
    if (!text) { prevLine = null; continue } // 空白行：段落分隔
    const isHeading = median > 0 && line.fontSize > median * 1.18
    const isListItem = BULLET_RE.test(text)
    const bigGap = prevLine != null && prevLine.box.bottom - line.box.top > line.fontSize * 0.55
    if (!cur || isHeading || isListItem || bigGap) {
      if (cur) blocks.push(cur)
      cur = {
        type: isHeading ? 'heading' : isListItem ? 'list_item' : 'paragraph',
        heading: null,
        page,
        parts: [text],
        box: line.box,
      }
    } else {
      cur.parts.push(text)
      cur.box = unionBox(cur.box, line.box)
    }
    prevLine = line
  }
  if (cur) blocks.push(cur)

  return blocks.map((b) => ({
    type: b.type,
    heading: b.heading,
    page: b.page,
    text: b.parts.reduce((acc, t) => (acc === '' ? t : joinLines(acc, t)), ''),
    bbox: b.box,
  }))
}

// ── 行构建 ──────────────────────────────────────────────

function buildLines(items) {
  const lines = []
  let cur = null
  for (const it of items) {
    const x0 = Number(it.transform?.[4]) || 0
    const y0 = Number(it.transform?.[5]) || 0
    const height = Number(it.height) || 10
    const width = Number(it.width) || 0
    if (!cur) cur = { text: '', parts: 0, prevX1: null, box: null, maxH: 0 }
    // 水平间隙补空格：与上一个项相距超过约 0.3 字符宽
    if (cur.parts > 0 && cur.prevX1 != null && x0 - cur.prevX1 > height * 0.3) cur.text += ' '
    cur.text += it.str
    cur.parts += 1
    cur.box = unionBox(cur.box, itemBox(x0, y0, width, height))
    cur.maxH = Math.max(cur.maxH, height)
    cur.prevX1 = x0 + width
    if (it.hasEOL) { lines.push(toLine(cur)); cur = null }
  }
  if (cur) lines.push(toLine(cur))
  return lines
}

function toLine(cur) {
  return { text: cur.text.trim(), box: cur.box, fontSize: cur.maxH }
}

/** 单个文本项的近似包围盒：基线在 transform[5]，字形约占基线上方 0.8h、下方 0.2h */
function itemBox(x0, y0, width, height) {
  return { x0, top: y0 + height * 0.8, x1: x0 + width, bottom: y0 - height * 0.2 }
}

/** 相邻行文本拼接：接缝任一侧为汉字则不补空格（中文换行），否则补一个空格 */
function joinLines(a, b) {
  const isHan = (c) => /\p{Script=Han}/u.test(c)
  return isHan(a.slice(-1)) || isHan(b.slice(0, 1)) ? a + b : `${a} ${b}`
}

function unionBox(a, b) {
  if (!a) return { ...b }
  return {
    x0: Math.min(a.x0, b.x0),
    top: Math.max(a.top, b.top),
    x1: Math.max(a.x1, b.x1),
    bottom: Math.min(a.bottom, b.bottom),
  }
}

function medianOf(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

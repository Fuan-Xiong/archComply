// src/rules/parser.js —— 文档解析（B2 Owner）
// 交付标准：保留 docId / docName / page / blockId / charStart / charEnd / text
// 这里的实现是"可跑通的确定性版本"：docx 按其 XML 段落切块，txt/md 按空行切块。
// B2 可以替换内部实现（换 mammoth/pdf-parse 等），但 block 结构不许改 —— 前端溯源靠它。

import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { inflateRawSync } from 'node:zlib'

/**
 * @typedef {object} Block
 * @property {string} blockId   段落唯一 id（p-000123），前端高亮锚点
 * @property {number} page      1-based；docx 无分页信息时按字符量估算
 * @property {number} charStart 块内起点（0），同一 block 内偏移由证据层计算
 * @property {number} charEnd   块内终点（= text.length）
 * @property {string} text
 *
 * @typedef {object} ParsedDoc
 * @property {string} docId
 * @property {string} docName
 * @property {number} pageCount
 * @property {Block[]} blocks
 */

const PAGE_CHARS = 1200 // 估算每页字符数（无真实分页时的兜底）

/** 主入口：按扩展名分派 */
export async function parseDocument(input) {
  const { buffer, docName = 'document', docId = randomUUID() } = input
  const ext = extname(docName).toLowerCase()
  let paragraphs
  if (ext === '.docx') paragraphs = await extractDocx(buffer)
  else if (ext === '.txt' || ext === '.md') paragraphs = String(buffer).split(/\n\s*\n/)
  else throw new Error(`暂不支持的格式: ${ext || '(无扩展名)'}（支持 .docx/.txt/.md）`)

  const blocks = buildBlocks(paragraphs)
  if (blocks.length === 0) throw new Error('解析结果为空：文档无可用文本')
  const pageCount = blocks.at(-1).page

  return { docId, docName: docName || basename(docName), pageCount, blocks }
}

/** docx：readFile 传入 Buffer；zip → word/document.xml → w:p 段落 */
async function extractDocx(buffer) {
  const { xml } = unzipEntry(buffer, 'word/document.xml')
  const paragraphs = []
  const pRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>|<w:p\b[^>]*\/>/g
  let m
  while ((m = pRe.exec(xml))) {
    const body = m[1] ?? ''
    const text = [...body.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g)]
      .map((t) => (t[0].startsWith('<w:tab') ? '\t' : t[0].startsWith('<w:br') ? '\n' : t[1]))
      .join('')
    const clean = decodeXml(text).replace(/\s+$/g, '')
    if (clean.trim()) paragraphs.push(clean)
  }
  return paragraphs
}

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&')
}

/** 最小 ZIP 读取：只支持 stored/deflate，够读 docx 的 document.xml */
function unzipEntry(buf, entryName) {
  const EOCD = 0x06054b50
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i -= 1) if (buf.readUInt32LE(i) === EOCD) { eocd = i; break }
  if (eocd < 0) throw new Error('docx 不是合法 zip')
  const count = buf.readUInt16LE(eocd + 10)
  let off = buf.readUInt32LE(eocd + 16)
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break
    const method = buf.readUInt16LE(off + 10)
    const compSize = buf.readUInt32LE(off + 20)
    const nameLen = buf.readUInt16LE(off + 28)
    const extraLen = buf.readUInt16LE(off + 30)
    const commentLen = buf.readUInt16LE(off + 32)
    const localOff = buf.readUInt32LE(off + 42)
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen)
    if (name === entryName) {
      const lNameLen = buf.readUInt16LE(localOff + 26)
      const lExtraLen = buf.readUInt16LE(localOff + 28)
      const start = localOff + 30 + lNameLen + lExtraLen
      const raw = buf.subarray(start, start + compSize)
      const data = method === 0 ? raw : inflateRawSync(raw)
      return { name, xml: data.toString('utf8') }
    }
    off += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`docx 内未找到 ${entryName}`)
}

function buildBlocks(paragraphs) {
  const blocks = []
  let page = 1
  let pageChars = 0
  paragraphs.forEach((raw, idx) => {
    const text = raw.replace(/\r/g, '')
    if (!text.trim()) return
    if (pageChars > PAGE_CHARS) { page += 1; pageChars = 0 }
    pageChars += text.length
    blocks.push({
      blockId: `p-${String(idx).padStart(6, '0')}`,
      page,
      charStart: 0,
      charEnd: text.length,
      text,
    })
  })
  return blocks
}

/** 从本地路径读取并解析（CLI/联调用） */
export async function parseFile(path) {
  const buffer = await readFile(path)
  return parseDocument({ buffer, docName: basename(path) })
}

/** 全文（给检索用；不要整篇塞给模型） */
export function toFullText(parsed) {
  return parsed.blocks.map((b) => b.text).join('\n')
}

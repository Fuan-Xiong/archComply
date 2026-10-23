// useSSE.js —— SSE 客户端（F Owner）
// 协议：docs/sse-events.md ｜ 真实后端与 Mock 服务协议完全一致，只换 BASE
// 特性：fetch + ReadableStream 增量解析、AbortController 中断、错误/重试状态

export const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'

/**
 * @param {object} body
 * @param {{onEvent:(event:string,data:any)=>void, signal?:AbortSignal}} opts
 */
export async function runReview(body, { onEvent = () => {}, signal } = {}) {
  const res = await fetch(`${BASE}/api/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += value
    let idx
    // 帧分隔为空行；兼容 \r\n
    while ((idx = buf.search(/\r?\n\r?\n/)) !== -1) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + (buf[idx] === '\r' ? 4 : 2))
      const { event, data } = parseFrame(raw)
      if (!data) continue
      try {
        onEvent(event, JSON.parse(data))
      } catch (err) {
        console.warn('[sse] 无法解析事件', event, err)
      }
    }
  }
}

function parseFrame(raw) {
  let event = 'message'
  let data = ''
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith(':')) continue // 心跳
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  return { event, data }
}

/** Mock 模式：不启服务直接回放（协议一致） */
export async function runMock(body, opts) {
  const { mockRun } = await import('../../../mock/browser-mock.mjs')
  return mockRun(body, opts)
}

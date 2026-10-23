<script setup>
// App.vue —— 演示用最小可跑页面（F Owner 可整体替换）
// 覆盖：流式聊天、进度、结果卡片、覆盖矩阵告警、Token/耗时、中断、重试、溯源高亮
import { computed, ref } from 'vue'
import { runReview, BASE } from './composables/useSSE'
import MessageList from './components/MessageList.vue'
import ResultCard from './components/ResultCard.vue'
import TraceViewer from './components/TraceViewer.vue'
import MetricsPanel from './components/MetricsPanel.vue'

const messages = ref([])
const issues = ref([])
const progress = ref({ percent: 0, stageLabel: '', detail: '' })
const metrics = ref(null)
const result = ref(null)
const status = ref('idle') // idle | running | done | error | aborted
const errorMsg = ref('')
const traceHint = ref(null)
let ac = null

const canStart = computed(() => status.value !== 'running')
const coverage = computed(() => result.value?.coverage ?? null)

function handleEvent(event, data) {
  switch (event) {
    case 'meta':
      metrics.value = { tokenIn: 0, tokenOut: 0, tokenTotal: 0, durationMs: 0 }
      break
    case 'progress':
      progress.value = data
      break
    case 'message':
      appendMessage(data)
      break
    case 'rule_result':
      upsertIssue(data)
      break
    case 'metrics':
      metrics.value = data
      break
    case 'result':
      result.value = data.payload
      issues.value = data.payload.issues ?? []
      metrics.value = { ...metrics.value, ...data.payload.metrics }
      break
    case 'error':
      errorMsg.value = `${data.code}：${data.message}`
      status.value = data.code === 'aborted' ? 'aborted' : 'error'
      break
    case 'done':
      progress.value = { percent: 100, stageLabel: '完成', detail: '' }
      if (status.value === 'running') status.value = 'done'
      break
  }
}

function appendMessage({ delta, channel = 'text', ruleId = null }) {
  if (!delta) return
  const last = messages.value[messages.value.length - 1]
  // 同一 ruleId/同一 channel 的片段合并，避免碎成一堆气泡
  if (last && last.channel === channel && last.ruleId === ruleId) last.text += delta
  else messages.value.push({ channel, ruleId, text: delta })
}

function upsertIssue(r) {
  const idx = issues.value.findIndex((i) => i.ruleId === r.ruleId)
  const item = { ...r }
  if (idx >= 0) issues.value.splice(idx, 1, item)
  else issues.value.push(item)
}

async function start() {
  messages.value = []
  issues.value = []
  result.value = null
  traceHint.value = null
  errorMsg.value = ''
  progress.value = { percent: 0, stageLabel: '准备中', detail: '' }
  status.value = 'running'
  ac = new AbortController()
  try {
    await runReview({ docIds: ['doc-001'], mode: 'demo' }, { onEvent: handleEvent, signal: ac.signal })
    if (status.value === 'running') status.value = 'done'
  } catch (err) {
    if (err.name === 'AbortError') status.value = 'aborted'
    else {
      status.value = 'error'
      errorMsg.value = err.message
    }
  }
}

function abort() {
  ac?.abort()
  status.value = 'aborted'
}

function locate(evidence) {
  traceHint.value = evidence
}

const statusLabel = {
  idle: '待开始', running: '评审中…', done: '已完成', error: '出错', aborted: '已中断',
}
</script>

<template>
  <header class="topbar">
    <h1>archComply <span>合同合规评审</span></h1>
    <div class="status">
      <span :class="['dot', status]"></span>{{ statusLabel[status] }}
      <code>{{ BASE }}</code>
    </div>
  </header>

  <main class="layout">
    <section class="left">
      <div class="toolbar">
        <button :disabled="!canStart" @click="start">
          {{ status === 'done' ? '重新评审' : '开始评审' }}
        </button>
        <button class="ghost" :disabled="status !== 'running'" @click="abort">中断</button>
        <button v-if="status === 'error' || status === 'aborted'" class="ghost" @click="start">重试</button>
        <div class="bar" :title="`${progress.percent}%`">
          <div class="fill" :style="{ width: progress.percent + '%' }"></div>
        </div>
        <small>{{ progress.percent }}% · {{ progress.stageLabel }} {{ progress.detail }}</small>
      </div>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

      <MessageList :messages="messages" />

      <div class="cards">
        <ResultCard
          v-for="i in issues"
          :key="i.ruleId"
          :item="i"
          @locate="locate"
        />
      </div>
    </section>

    <aside class="right">
      <MetricsPanel :metrics="metrics" :coverage="coverage" :summary="result?.summary" />
      <TraceViewer :evidence="traceHint" />
    </aside>
  </main>
</template>

<style>
:root {
  --bg: #0f1115;
  --panel: #171a21;
  --line: #262b36;
  --text: #e6e9ef;
  --muted: #98a2b3;
  --red: #ef4444;
  --amber: #f59e0b;
  --green: #22c55e;
  --accent: #5b8def;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 14px/1.6 -apple-system, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
}
.topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 20px; border-bottom: 1px solid var(--line);
}
.topbar h1 { font-size: 17px; margin: 0; letter-spacing: .5px; }
.topbar h1 span { color: var(--muted); font-weight: 400; font-size: 13px; margin-left: 8px; }
.status { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; }
.status code { background: #10131a; padding: 2px 6px; border-radius: 4px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.dot.running { background: var(--accent); animation: pulse 1s infinite; }
.dot.done { background: var(--green); }
.dot.error { background: var(--red); }
.dot.aborted { background: var(--amber); }
@keyframes pulse { 50% { opacity: .35 } }
.layout { display: grid; grid-template-columns: 1fr 380px; gap: 16px; padding: 16px; align-items: start; }
@media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
.toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
button {
  background: var(--accent); color: #fff; border: 0; border-radius: 6px;
  padding: 8px 16px; cursor: pointer; font-size: 13px;
}
button:disabled { opacity: .45; cursor: not-allowed; }
button.ghost { background: transparent; border: 1px solid var(--line); color: var(--text); }
.bar { flex: 1; min-width: 140px; height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
.fill { height: 100%; background: var(--accent); transition: width .3s; }
.toolbar small { color: var(--muted); width: 100%; }
.error { color: var(--red); background: #2a1518; padding: 8px 12px; border-radius: 6px; }
.cards { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.right { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 16px; }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; }
.panel h3 { margin: 0 0 8px; font-size: 13px; color: var(--muted); font-weight: 600; }
</style>

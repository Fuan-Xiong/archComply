<script setup>
// ResultCard.vue —— 单条规则结果卡片（fail / review / pass）
const props = defineProps({ item: { type: Object, required: true } })
const emit = defineEmits(['locate'])

const labels = { fail: '不合规', review: '需复核', pass: '合规' }
const sev = { high: '高', medium: '中', low: '低' }
</script>

<template>
  <article :class="['card', item.verdict]">
    <header>
      <span :class="['badge', item.verdict]">{{ labels[item.verdict] ?? item.verdict }}</span>
      <strong>{{ item.ruleId }}</strong>
      <span class="title">{{ item.title }}</span>
      <span v-if="item.severity" :class="['sev', item.severity]">{{ sev[item.severity] }}</span>
      <span class="method" :title="item.method === 'deterministic' ? '代码比对，零 Token' : '模型判定'">
        {{ item.method === 'deterministic' ? '规则比对' : '模型判定' }}
      </span>
      <span v-if="typeof item.confidence === 'number'" class="conf">{{ Math.round(item.confidence * 100) }}%</span>
    </header>
    <p class="reason">{{ item.reason }}</p>
    <p v-if="item.suggestion" class="suggest">建议：{{ item.suggestion }}</p>
    <ul v-if="item.evidence?.length" class="ev">
      <li v-for="(e, i) in item.evidence" :key="i" @click="emit('locate', e)">
        <span class="where">{{ e.docName }} · 第{{ e.page }}页 · {{ e.blockId }}</span>
        <span class="snippet">「{{ e.snippet }}」</span>
        <span class="jump">定位 ›</span>
      </li>
    </ul>
    <p v-else class="noev">无证据：按铁律不判不合规，转人工复核。</p>
  </article>
</template>

<style scoped>
.card { background: var(--panel); border: 1px solid var(--line); border-left-width: 3px; border-radius: 8px; padding: 10px 14px; }
.card.fail { border-left-color: var(--red); }
.card.review { border-left-color: var(--amber); }
.card.pass { border-left-color: var(--green); }
header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.badge { font-size: 11px; padding: 1px 7px; border-radius: 10px; font-weight: 600; }
.badge.fail { background: #3a1418; color: var(--red); }
.badge.review { background: #35260b; color: var(--amber); }
.badge.pass { background: #10291a; color: var(--green); }
.title { color: var(--text); }
.sev { font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
.sev.high { color: var(--red); border-color: #4a2024; }
.sev.medium { color: var(--amber); border-color: #4a3a1a; }
.method { font-size: 11px; color: var(--accent); }
.conf { margin-left: auto; font-size: 11px; color: var(--muted); }
.reason { margin: 8px 0 4px; }
.suggest { margin: 0; color: var(--muted); font-size: 13px; }
.ev { list-style: none; margin: 8px 0 0; padding: 0; }
.ev li {
  display: flex; gap: 8px; align-items: baseline; cursor: pointer;
  background: #10131a; border-radius: 6px; padding: 6px 8px; font-size: 12px; margin-top: 6px;
}
.ev li:hover { outline: 1px solid var(--accent); }
.where { color: var(--muted); flex: none; }
.snippet { color: #cbd5e1; }
.jump { margin-left: auto; color: var(--accent); flex: none; }
.noev { margin: 8px 0 0; font-size: 12px; color: var(--amber); }
</style>

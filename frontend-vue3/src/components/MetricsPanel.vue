<script setup>
// MetricsPanel.vue —— Token / 耗时 / 覆盖矩阵（队长路演讲的就是这几块）
import { computed } from 'vue'

const props = defineProps({
  metrics: { type: Object, default: null },
  coverage: { type: Object, default: null },
  summary: { type: Object, default: null },
})

const m = computed(() => props.metrics ?? {})
const secs = computed(() => ((m.value.durationMs ?? 0) / 1000).toFixed(1))
const rate = computed(() => Math.round((props.coverage?.rate ?? 0) * 100))
const bars = computed(() => {
  // 按严重级别统计问题数（fail + review）
  const c = { high: 0, medium: 0, low: 0 }
  for (const i of props.summary?.bySeverity ?? []) c[i.severity] = i.count
  return c
})
</script>

<template>
  <section class="panel">
    <h3>指标</h3>
    <div class="grid">
      <div><b>{{ m.tokenTotal ?? 0 }}</b><span>Token</span></div>
      <div><b>{{ secs }}s</b><span>总耗时</span></div>
      <div><b>{{ summary?.fail ?? 0 }}</b><span>不合规</span></div>
      <div><b>{{ summary?.review ?? 0 }}</b><span>需复核</span></div>
    </div>
    <div v-if="coverage" class="cov">
      <div class="covhead">
        <span>规则覆盖</span>
        <b :class="{ warn: coverage.pending > 0 }">{{ coverage.done }}/{{ coverage.total }}（{{ rate }}%）</b>
      </div>
      <div class="cbar"><div class="cfill" :style="{ width: rate + '%' }"></div></div>
      <p v-if="coverage.uncoveredAlerts?.length" class="alert">
        未覆盖：{{ coverage.uncoveredAlerts.join('、') }} —— 这些规则没查到，不当作合规。
      </p>
      <div class="chips">
        <span v-for="i in coverage.items" :key="i.ruleId" :class="['chip', i.state]">
          {{ i.ruleId }}
        </span>
      </div>
    </div>
    <p v-if="m.stages?.length" class="stages">
      阶段耗时：<span v-for="s in m.stages" :key="s.name">{{ s.name }} {{ (s.durationMs / 1000).toFixed(1) }}s</span>
    </p>
  </section>
</template>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.grid div { background: #10131a; border-radius: 6px; padding: 8px; text-align: center; }
.grid b { display: block; font-size: 16px; }
.grid span { font-size: 11px; color: var(--muted); }
.cov { margin-top: 12px; }
.covhead { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); }
.covhead b.warn { color: var(--red); }
.cbar { height: 6px; background: var(--line); border-radius: 3px; margin: 6px 0; overflow: hidden; }
.cfill { height: 100%; background: var(--green); }
.alert { color: var(--red); font-size: 12px; margin: 6px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { font-size: 10px; padding: 1px 5px; border-radius: 4px; border: 1px solid var(--line); color: var(--muted); }
.chip.done { color: var(--green); border-color: #1d3a26; }
.chip.review { color: var(--amber); border-color: #3a2f14; }
.chip.pending { color: var(--red); border-color: #3a1a1e; }
.stages { font-size: 11px; color: var(--muted); margin: 10px 0 0; display: flex; flex-wrap: wrap; gap: 8px; }
</style>

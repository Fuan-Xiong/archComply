<script setup>
// TraceViewer.vue —— 溯源面板：展示命中段落 + 字符级高亮
// 生产版应渲染整篇文档并按 blockId 滚动；骨架阶段先展示证据块与偏移区间。
const props = defineProps({ evidence: { type: Object, default: null } })

const before = (e) => e.snippet.slice(0, 0)
</script>

<template>
  <section class="panel">
    <h3>溯源</h3>
    <p v-if="!evidence" class="hint">点击任意卡片里的证据行，这里显示原文与命中区间。</p>
    <div v-else class="trace">
      <div class="meta">
        <span>{{ evidence.docName }}</span>
        <span>第 {{ evidence.page }} 页</span>
        <code>{{ evidence.blockId }}</code>
      </div>
      <blockquote>
        <mark>{{ evidence.snippet }}</mark>
      </blockquote>
      <div class="range">
        字符区间 <code>[{{ evidence.charStart }}, {{ evidence.charEnd }})</code>
        · 长度 {{ evidence.charEnd - evidence.charStart }}
      </div>
      <p class="note">生产版按 blockId 滚动原文 DOM 节点并高亮此区间，不靠关键词搜索定位。</p>
    </div>
  </section>
</template>

<style scoped>
.hint { color: var(--muted); font-size: 13px; margin: 0; }
.meta { display: flex; gap: 8px; font-size: 12px; color: var(--muted); flex-wrap: wrap; }
.meta code { background: #10131a; padding: 0 4px; border-radius: 4px; }
blockquote {
  margin: 10px 0; padding: 10px 12px; background: #10131a;
  border-left: 3px solid var(--accent); border-radius: 4px; font-size: 13px;
}
mark { background: #3b3210; color: #fde68a; padding: 0 2px; border-radius: 2px; }
.range { font-size: 12px; color: var(--muted); }
.note { font-size: 11px; color: #6b7280; margin: 8px 0 0; }
</style>

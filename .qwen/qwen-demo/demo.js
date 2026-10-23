import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stdout } from 'node:process'
import { query } from '@qwen-code/sdk'
import pc from 'picocolors'

// 指定工作目录为当前目录
const workdir = import.meta.dirname
const qwenDir = join(workdir, '.qwen')
const settingsPath = join(qwenDir, 'settings.json')

// 配置大模型
const env = {
  OPENAI_BASE_URL: 'http://localhost:8080/v1',
  OPENAI_MODEL: 'qwen3.8-27b',
  OPENAI_API_KEY: 'api-key',
}
// 工作目录的 setting.json 配置
const settings = {
  model: {
    name: env.OPENAI_MODEL,
    generationConfig: { modalities: { image: true } }, // 开启多模态
  },
  modelProviders: { openai: [] }, // 覆盖用户目录下的全局 openai 配置
}
await mkdir(qwenDir, { recursive: true })
await writeFile(settingsPath, JSON.stringify(settings), 'utf-8')

// 调用 Qwen
const result = query({
  // skill 放在工作目录的 .qwen/skills 中
  prompt: 'use example skill, 做点什么',
  options: {
    cwd: workdir,
    permissionMode: 'yolo',
    includePartialMessages: true,
    env,
  },
})

const start_ts = Date.now()
// 流式输出 Qwen 结果
for await (const message of result) {
  // 系统信息
  if (message.type === 'system') {
    console.log(`${pc.cyan('[system]')}`, JSON.stringify(message))
  }

  // 工具调用信息
  else if (message.type === 'assistant') {
    for (const block of message.message.content) {
      if (block.type === 'tool_use') {
        console.log(
          `${pc.cyan('[tool_use]')} [${block.id}] ${block.name} ${pc.dim(pc.gray(JSON.stringify(block.input)))}`,
        )
      }
    }
  }

  // 工具调用结果
  else if (message.type === 'user') {
    for (const block of message.message.content) {
      if (typeof block === 'string' || block.type !== 'tool_result') continue
      console.log(
        `${pc.cyan('[tool_result]')} [${block.tool_use_id}]`,
        block.is_error
          ? `${pc.red('error')} ${pc.dim(block.content)}`
          : `${pc.green('success')}`,
      )
    }
  }

  // 流式输出文本和思考内容
  else if (message.type === 'stream_event') {
    if (message.event.type === 'content_block_start') {
      if (['text', 'thinking'].includes(message.event.content_block.type))
        stdout.write(pc.cyan(`\n[${message.event.content_block.type}] `))
    }

    if (message.event.type === 'content_block_delta') {
      // 正文内容
      if (message.event.delta.type === 'text_delta')
        stdout.write(pc.bold(message.event.delta.text))
      // 思考内容
      if (message.event.delta.type === 'thinking_delta')
        stdout.write(pc.dim(message.event.delta.thinking))
    }
  }

  // 输出结果表示回答结束
  if (message.type === 'result') {
    console.log('\n\n--------------------\n')
    console.log(pc.cyan('[Token用量]'), message.usage)
  }
}
console.log(`${pc.cyan('[耗时]')} ${(Date.now() - start_ts) / 1000}s`)

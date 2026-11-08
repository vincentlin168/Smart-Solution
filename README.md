# Smart Solution（智能方案）

售前方案写作工作台。作者在一个文档编辑器里写方案，借助两个工具补充素材和图形：

- **Tool01 素材检索**：按选中文案或关键词，从企业内部和当前项目的素材库里找 PPT 页面、架构图、流程图、截图，并插入到文档。
- **Tool02 图形生成**：把选中的文案变成图形，可在文档中预览、反复修改、导出为 `.drawio`、SVG、PNG，并插入正文。

## 功能

- 三栏工作台：左侧大纲栏、中间正文、右侧资料栏与助手栏，均可收起，给正文更大空间。
- Tool02 两种出图方式：
  - **规则生成**：本地算法从文案提取层级或步骤，按固定版式排版。不需要 AI，稳定但样式有限。
  - **AI 生成**：调用大模型。
    - **自由绘制**：模型直接输出 draw.io XML，可设计泳道、判断菱形、数据库圆柱、分支汇聚等版式。
    - **结构化**：模型只提取层级或步骤，版式仍由本地算法决定。
- 作者提示词：颜色、字体、形状、布局等要求会落实到图形样式里。
- 垫图：可上传或粘贴最多 3 张参考图，由支持图片输入的模型参照其版式和风格。
- 反复修改与版本历史：每次修改保存一个版本，可随时恢复。自由绘制图的修改基于当前 XML 进行。
- 校验：检查 XML 结构、连线引用、文字截断、图形重叠，以及图中文字是否来自选中文案。

## 技术栈

Next.js 16、React 19、TypeScript、Tailwind CSS 4、shadcn/ui、pnpm。

> 本项目使用的 Next.js 版本与常见版本有差异。开发前请先阅读 `node_modules/next/dist/docs/` 里的相关文档，见 `AGENTS.md`。

## 快速开始

需要 Node.js 和 pnpm（`package.json` 里声明的版本为 `pnpm@12.3.4`）。

```bash
pnpm install
pnpm dev
```

然后访问终端里提示的本地地址（默认 http://localhost:3000）。

其他命令：

```bash
pnpm build   # 生产构建
pnpm start   # 运行生产构建
npx tsc --noEmit   # 类型检查
```

项目目前没有 ESLint 配置和自动化测试。

## 配置 AI

AI 功能需要一个 OpenAI 兼容的 chat/completions 接口。支持的服务商为 `openai` 和 `deepseek`。

**方式一：界面配置。** 点击顶栏的齿轮按钮，填写服务商、API Key、Endpoint 和模型。这些设置保存在浏览器 localStorage 中，并在请求时通过请求头 `x-ai-api-key` 发给本应用的后端。

**方式二：环境变量。** 在项目根目录创建 `.env.local`（已被 `.gitignore` 排除）：

```bash
AI_API_KEY=你的密钥
AI_API_ENDPOINT=https://你的服务地址/v1   # 可选，不填则用服务商默认地址
NEXT_PUBLIC_AI_PROVIDER=openai             # 可选：openai | deepseek
```

后端优先使用环境变量中的 `AI_API_KEY`，没有时才使用界面传来的 Key。Endpoint 可以只写到 `/v1`，后端会自动补上 `/chat/completions`。

要使用**垫图**，所选模型必须支持图片输入（例如 gpt-4o 系列）。

### 安全提示

- 不要把 API Key 写进代码或提交到仓库。
- 界面配置的 Key 存在浏览器 localStorage，只适合个人本地使用。多人使用或对外部署时，请改用服务端环境变量，并给 `/api/diagram/generate` 加上身份认证。该接口目前没有认证，部署到公网会让任何人消耗你的额度。

## 自由绘制的安全处理

模型输出的 draw.io XML 不会被原样使用。服务端按白名单解析成内部结构，预览和导出的 `.drawio` 都由这个结构重新生成：

- 只保留允许的形状和 style 键，颜色只接受 `#RRGGBB`。
- 脚本、事件属性、外部链接和图片地址都会被丢弃。
- 非法或重复的 id 会重新分配，坐标和尺寸有上限，父子关系有层级限制。
- 节点上限 150 个，XML 长度上限 60KB。

实现见 `lib/workbench/drawio.ts`。

## 目录结构

```
app/
  api/diagram/generate/route.ts   图形生成接口（结构化 / draw.io XML 两种输出）
  page.tsx, layout.tsx
components/
  ui/                             基础 UI 组件（shadcn/ui）
  workbench/                      工作台：顶栏、大纲、编辑器、Tool01、Tool02 等
lib/workbench/
  diagram.ts                      结构化出图、布局、校验、提示词合规检查
  drawio.ts                       draw.io XML 解析、清洗、序列化、预览排版
  export.ts                       导出
  search.ts, seed.ts              素材检索与示例数据
  types.ts                        类型定义
public/materials/                 示例素材图片
```

## 已知限制

- 素材库目前是内置的示例数据（`lib/workbench/seed.ts`），尚未接入真实素材来源。
- 自由绘制的预览是自实现的 SVG 渲染，只覆盖常用形状，复杂图在 draw.io 中打开可能略有差异。
- 自由绘制时模型可能补充选中文案里没有的内容，校验会提示，需要人工核对。
- 文档内容保存在浏览器会话里，没有后端持久化。

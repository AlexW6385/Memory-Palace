# 记忆宫殿 · Memory Palace

> An LLM designs knowledge systems (undergrad math, CS, Hegel, …) and picks an
> architecture for each; a deterministic layout engine turns them into a walkable
> 3D world you browse in the browser. You remember things by where they stand.

把一个个知识体系建成一座可以在浏览器里漫游的三维宫殿。LLM 负责“设计”：拆分区、展厅、展品，写讲解和记忆画面，
并为每个体系挑一种建筑形式；布局引擎负责“施工”：把语义结构确定性地变成坐标、可行走的地面和导览路线。
访客只需要走一走、看一看。

目前宫殿里有五个体系，共 318 件展品：

| 体系 | 建筑 | 结构 |
|---|---|---|
| 黑格尔哲学体系 | 螺旋上升的塔 | 精神现象学 → 逻辑学 → 自然哲学 → 主观与客观精神 → 绝对精神，沿坡道一路登顶 |
| 本科数学 | 城市 | 逻辑、分析、线代、抽代、组合、概率六个街区 |
| 计算机科学基础 | 阶梯金字塔 | 从数字逻辑一层层登上计算理论 |
| 软件开发 | 长街 | 沿开发流程经过需求、编码、后端架构、数据、测试、运维 |
| 大模型与 Agent 原理 | 放射状广场 | 以“预测下一个 token”为中心，六条长廊向外 |

## 快速开始

```bash
pip install -e ".[dev]"
python -m palace build          # 布局 → web/data/world.json（仓库里已带一份）
python -m palace serve          # 打开 http://127.0.0.1:8000
```

只想看看的话，任何静态服务器都行：`python -m http.server -d web`。

**操作**：手机上左下摇杆走路、拖动屏幕转头、点展品看卡片；电脑上 W A S D 走、拖动鼠标转头、Shift 奔跑。
「导览」会自动沿路线走过一个体系的全部展品，在每件前停下展示卡片；「目录」可以搜索和跳转；「地图」点哪去哪。

## 让 LLM 建一个新区域

```bash
export ANTHROPIC_API_KEY=...        # 或 OPENAI_API_KEY=...
python -m palace generate "线性代数"
python -m palace generate "我的实习经验" --notes "$(cat notes.md)"   # 个人主题只依据你给的材料
```

也可以在 `palace serve` 打开的页面里，从「目录」底部输入主题直接建造。两家都支持，用
`--provider anthropic|openai` 和 `--model` 选择；默认模型可用 `PALACE_ANTHROPIC_MODEL`、`PALACE_OPENAI_MODEL` 覆盖。

生成分三步：大纲（含建筑模板）→ 各展厅并行写展品 → 找体系内和跨体系的关联。每一步的输出都按 schema 校验，
不通过就把错误发回模型重写。新体系会占用一块空地，已有体系的位置永远不变。

## 架构

```
content/systems/*.json   LLM 写的语义内容（无坐标），schema 见 palace/schema.py
content/crosslinks.json  跨体系的关联（地图上空的“桥”）
content/manifest.json    每个体系占哪块地，只增不改
        │
palace/templates/        五种建筑：spiral / city / terraces / avenue / radial
palace/world.py          世界：中央广场 + 3×3 地块，组装场景、地面、碰撞体
palace/nav.py            可行走规则、栅格烘焙、A* 与拉直，生成导览路线
        │
web/data/world.json      渲染图元 + 可行走面 + 展品 + 导览路径
web/js/                  three.js 浏览端（nav.js 与 nav.py 规则一致）
palace/server.py         FastAPI：静态页面 + 生成任务 API
```

几个设计取舍：

- **LLM 只定语义，坐标由代码算。** 模型擅长组织知识、写记忆画面，不擅长给出不重叠、可走通的坐标。模板根据
  分区/展厅/展品的数量确定性地布局，同样的内容永远得到同样的宫殿——这正是记忆宫殿需要的。
- **一套行走规则，两处实现。** 站在当前高度 ±0.6 m 以内最高的那个面上；Python 用它验证每件展品都能从入口走到，
  浏览器用它做实时移动。坡道、螺旋坡道、阶梯平台都是同一种“面”。
- **导览路线离线算好。** 在 0.5 m 栅格上跑 A*，再用精确几何把折线拉直，浏览器只需沿折线播放。

## 测试

```bash
pytest
```

覆盖：schema 校验、每种模板在各种规模下不越界且展台不重叠、所有展品可达、导览路线全程踩在可走面上、
布局确定且新增体系不挪动旧体系、浏览器与 Python 的行走规则逐点一致（需要 node）、生成流水线（用脚本化的假 LLM）和 API。

## 接下来

- 个人区域：实习经历、项目、计划与待办。待办仍在普通面板里编辑，世界里只显示状态——进行中的项目是搭着脚手架的楼，
  完成了就落成。
- 复习：记录走过的展品，按间隔重复安排“回访路线”，很久没去的展厅慢慢积灰。

# 记忆宫殿 Memory Palace

[English](README.md)

一座可以在浏览器里漫游的三维记忆宫殿。每个知识体系是一座建筑，每个知识点是一个鲜明的小场景，立在路线上
带编号的位置。沿路线走一遍、看看卡片，就能凭“在哪里、长什么样”记住它们。

**在线浏览：<https://alexw6385.github.io/memory-palace/>**（电脑、手机都可以；中英双语，默认英文）

宫殿里有五个知识体系，共 332 件展品，全部中英双语：

| 体系 | 建筑 | 路线 |
|---|---|---|
| 黑格尔哲学体系 | 螺旋坡道登顶的塔 | 精神现象学 → 逻辑学（存在论、本质论、概念论）→ 自然哲学 → 精神哲学 → 绝对精神 |
| 本科数学 | 分街区的城市 | 逻辑与证明、集合、数论、组合、微积分、线性代数、概率 |
| 计算机科学基础 | 阶梯金字塔 | 从比特和机器起步，经操作系统、网络、编译、算法，登上可计算性理论 |
| 软件开发 | 一条长街 | 需求与设计、协作、数据、服务架构、测试、安全、交付运维 |
| 大模型与智能体 | 放射状广场 | 神经网络、Transformer、训练、推理、检索、智能体、安全 |

## 它怎样起到记忆宫殿的作用

位置记忆法是最古老的记忆术：把每个概念做成一个具体、鲜明的场景，放在一条路线上固定的位置。

- **路线上的固定位置**：路线就是学习顺序。每件展品有编号，每第 5 处是金色，每第 10 处带星，随时知道自己在哪。
- **有性格的展厅**：26 种主题展厅（图书馆、邮局、赌场、港口、天文台……），按内容挑选，展厅本身就是线索：
  消息队列在邮局，概率在赌场。
- **场景就是概念本身**：每件展品是用约 200 种手工建模的道具搭成的小场景。五只鸽子抢四个笼子，*就是*鸽巢原理。
  卡片会列出哪个物件代表什么。
- **回忆漫步**：隐藏标题和公式走一遍，先说出每个场景代表什么，再揭晓并自评；没记住的可以单独再练。

每张卡片有一句话要点、记忆画面、物与义的对应、解释、例子、关键词，以及和其他展品（包括其他体系）的关联。

**操作**：电脑上 W A S D 走、拖动转头、Shift 奔跑、点击展品看卡片、`M` 地图、`/` 搜索、`[` `]` 沿路线前后。
手机上左下摇杆走、拖动屏幕转头。「导览」自动带你走一条路线，「回忆」考你，「地图」点哪去哪，「中文 / EN」切换语言。

## 本地运行

```bash
pip install -e ".[dev]"
python -m palace build          # 布局 → web/data/world.json
python -m palace serve          # http://127.0.0.1:8000
```

只想浏览的话，任何静态服务器都行：`python -m http.server -d web`。

## 让 LLM 建一个新体系

```bash
export ANTHROPIC_API_KEY=...      # 或 OPENAI_API_KEY=...
python -m palace generate "linear algebra"
python -m palace generate "my internship" --notes "$(cat notes.md)"   # 个人主题只依据你给的材料
```

Claude 和 OpenAI 都支持（`--provider anthropic|openai`、`--model ...`，默认模型可用 `PALACE_ANTHROPIC_MODEL`、
`PALACE_OPENAI_MODEL` 设置）。用 `palace serve` 打开时，目录面板底部也可以直接建造。

生成分三步，每一步都会校验，不通过就把问题发回模型修改：大纲（含建筑模板和每个展厅的主题）→ 各展厅并行写展品
（双语全文、三维场景、关联；场景会做几何检查）→ 和已有体系之间的关联。新体系占一块空地，已有体系的位置永远不变。

## 架构

```
content/systems/*.json    语义内容，双语，没有坐标（schema 见 palace/schema.py）
content/crosslinks.json   跨体系的关联（天空中的光桥）
content/manifest.json     每个体系占哪块地，只增不改
        │
palace/catalog/           道具目录（208 种）与 26 种展厅风格
palace/scenes.py          场景道具在展台上的排布与几何检查
palace/halls.py           主题展厅：所有建筑模板的基本单元
palace/templates.py       五种建筑：spiral / city / terraces / avenue / radial
palace/world.py           广场、地块与风景；展品、编号、导览路线
palace/nav.py             可行走规则、栅格烘焙、A* 与路径拉直
        │
web/data/world.json       渲染图元 + 可行走面 + 展品 + 导览路径
web/js/                   three.js 浏览端：arch.js（建筑）、stage.js（展品场景）、props/（程序化道具）、
                          ui.js、map.js、i18n.js
```

开发、测试和部署见英文版 README。

## 许可

MIT

# Roshambo Requirement (实现同步版)

本文档以仓库当前实现为准，描述玩法规则、数据定义、流程状态与可扩展点。若实现发生变化，需同步更新本文档，并在 `.agent/progress.md`/`.agent/roadmap.md` 记录变更（如相关）。

## 1. 技术与结构
- 前端：原生 TypeScript + DOM 渲染（无 React/Vue/Svelte）
- 动画：GSAP
- 构建：Vite（位于 `ts/`）
- 配置：运行时通过 fetch 从 `ts/public/definition/` 加载

## 2. 配置与定义（Definition）
所有可配置内容集中在 `ts/public/definition/`：
- `levels.csv`：关卡配置（`level,goal,reward`），共 27 行（9 大关 x 3 小关）
- `initial.csv`：初始资源（按 deck 维度：chips/interest/deal/shuffle）
- `deckdefinition.json`：卡组定义（deck 列表、卡牌 code、解锁引用）
- `shopdefinition.json`：商店生成规则（直购/奖励包权重、类型权重、价格规则）
- `sleevedefinition.json`：卡套定义（框架已建，暂未完整接入玩法）
- `giftcarddefinition.json`：兑奖券定义（框架已建，暂未完整接入玩法）
- `blockasset.csv` / `cardasset.csv`：资源映射表

### 2.1 Card Code 规则
deckdefinition 中的 `code` 由 3 位数字组成（对应 1x3 卡牌的 3 个元素），映射如下：
- `0` -> BLANK
- `1` -> PAPER
- `3` -> SCISSORS
- `4` -> ROCK
- `7` -> TRICOLOR（三色）

示例：
- `300` 表示 [剪,空,空]
- `444` 表示 [石,石,石]
- `341` 表示 [剪,石,布]（杂色 3 图案）
- `777` 表示 [三色,三色,三色]

## 3. 核心元素与权重
### 3.1 RPS 元素
- ROCK / SCISSORS / PAPER / BLANK / TRICOLOR
- 克制：ROCK > SCISSORS > PAPER > ROCK
- 分值权重：ROCK=4，SCISSORS=3，PAPER=1，BLANK=0，TRICOLOR=2（作为显示/占位权重）

### 3.2 TRICOLOR（“三色格”）规则
- 三色格在对战时会选择“优势图案”参与结算：
  - 面对非空对手时，会选择能克制对手的图案结算
  - 面对空格（BLANK）时不需要选择优势，保持三色不固定
- 一旦参与过一次对战结算（对手非空），三色格会在棋盘上固定为对应的单色图案
- 若三色牌本身用于推进轨道，在首次遇到非空对手后也会固定成单色继续推进

## 4. 关卡结构与流程
### 4.1 关卡结构
- 9 个 Stage，每个 Stage 3 个 Tier，总计 27 关
- 主题按 Pocket -> Rubik -> Master 循环
  - Pocket：2x2
  - Rubik：3x3
  - Master：4x4

### 4.2 通关/失败/胜利
- 通关条件：在手牌耗尽前达到 `goal`
- 失败条件：手牌耗尽且未达标 -> GAME_OVER
- 全通关：完成 27 关 -> WIN

### 4.3 关卡结算与商店
当分数达到 `goal`：
- 立即结算关卡奖励与利息，增加筹码：
  - `totalReward = levelReward + projectedInterest`
- 进入奖励结算页（ROUND_REWARD）展示 breakdown
- 进入商店（SHOP）：
  - 当前会刷出 3 个 offer，来源限定为：卡套、礼品卡、额外卡牌
  - 每个 offer 有两种形式：
    - `direct`：直接购买并立即入库/入牌库
    - `pack`：先购买，再从 2 或 3 个候选里选 1 个
  - 卡套购买后加入卡套槽，当前上限由 `sleevedefinition.json.slotLimit` 控制
  - 礼品卡购买后进入礼品卡库存，当前上限由 `giftcarddefinition.json.inventoryLimit` 控制
  - 额外卡牌购买后加入本局的永久牌库模板，在后续关卡重新洗入 deck
  - 继续进入下一关；若已是最后一关则进入 WIN

## 5. 回合（一次放置）与经济
### 5.1 回合定义
“回合”定义为一次将选中手牌从矩阵边缘放置并完成对冲结算（一次 clash）。

### 5.2 回合收入
- 每回合结束后，根据“剩余手牌数量”发钱：每张手牌 +1 筹码
- 该收入发生在本回合用掉那张牌被从手牌移除之后

### 5.3 资源
- chips：货币
- interestRate：利息率（`projectedInterest = floor(chips * interestRate)`，可被特殊牌修饰）
- dealsLeft：替换手牌次数
- shufflesLeft：洗牌次数
- 特殊牌可能提供每关额外 deals/shuffles

## 6. 轨道对冲（Lane Clash）与计分
### 6.1 放置与轨道
玩家从矩阵 TOP/BOTTOM/LEFT/RIGHT 某一边缘，选择一个 offset，把 1x3 卡牌推入。卡牌上的 3 个元素分别对应一条轨道（行/列），逐格推进结算。

### 6.2 单格结算
对每一步：
- 胜利：攻击方克制防守方或防守方为空格（BLANK）
  - 获得分数：等于被吃掉的防守方格子的权重
  - 攻击方占据该格并继续前进
- 平局：双方相同，停止推进
- 失败：攻击方被克制
  - 倒扣分数：等于攻击方自身权重
  - 触发 Lane Shift：该条轨道整体向“推入方向的反方向”平移一格

### 6.3 击穿翻倍（Pierce Multiplier）
一次放置中，如果某条轨道“击穿整条行/列”（在该次放置中该轨道被替换的格子数达到矩阵 size），则记为一次 pierce。

一次放置的得分分两段：
- baseScore：按正常规则累计的防守格分值总和
- pierceMultiplier：`2 ^ pierceCount`
- 最终加分：`scoreDelta = baseScore * pierceMultiplier`

说明：
- pierceCount 是一次放置中击穿的行/列数量（可同时触发多条）
- penalty（失败倒扣）不参与 pierceMultiplier 翻倍

## 7. 卡套、礼品卡与额外卡牌
### 7.1 卡套（Sleeve）
- 配置文件：`ts/public/definition/sleevedefinition.json`
- 运行时：`ts/src/definitions/sleeveDefinition.ts`
- 当前已接入玩法主链：
  - 商店购买
  - 被动分数修正（flat / multiplier）
  - 每关资源修正（如额外 deal）
  - 通关奖励修正（如关底加钱）
  - 利息预测修正（如每 5 筹码额外利息）

### 7.2 礼品卡（Gift Card）
- 配置文件：`ts/public/definition/giftcarddefinition.json`
- 运行时：`ts/src/definitions/giftcarddefinition.ts`
- 当前已接入玩法主链：
  - 商店购买
  - 礼品卡库存显示
  - PLAYING 状态下点击使用
  - 对选中手牌进行转换、复制、销毁、加权等一次性效果

### 7.3 额外卡牌（Card）
- 商店可出售与手牌/牌库同性质的 1x3 卡牌
- 当前卡池来源：
  - 所有由 `0/1/3/4` 任意混搭组成的 3 位 code
  - 所有包含 `O`（运行时映射为 TRICOLOR）的 3 位 code
- 价格由 `shopdefinition.json.cardPricing` 按规则计算，便于后续直接调表
- 若卡牌没有现成整图资产，UI 自动回退到 3 格动态渲染

### 7.4 覆盖范围
- 已实装条目与未实装原因见：`specs/item-coverage.md`
- 原则：
  - 能直接映射到 Roshambo 现有规则的条目，优先实装
  - 依赖未建立系统（点数/人头牌/Boss/行星/塔罗/异象/edition/sell value 等）的条目，先列入未覆盖清单

## 8. UI 与交互约定
- 左侧：状态机控制与信息面板（分数、筹码、资源按钮等）
- 右侧：矩阵、手牌、拖拽/吸附预览、特殊牌展示
- 动画：尽量使用 GSAP，以便统一节奏与可维护性

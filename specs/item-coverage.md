# Balatro Items Coverage

本文档记录 `reference/Balatro_Items_Reference_Roshambo.xlsx` 中“卡套 / 礼品卡”在当前 `ts/` 子工程里的落地情况。

## 已实装卡套
- Joker
- Greedy Joker
- Lusty Joker
- Wrathful Joker
- Gluttonous Joker
- Jolly Joker
- Zany Joker
- Crazy Joker
- Droll Joker
- Sly Joker
- Wily Joker
- Devious Joker
- Crafty Joker
- Half Joker
- Joker Stencil
- Banner
- Mystic Summit
- Loyalty Card
- Misprint
- Abstract Joker
- Runner
- Blue Joker
- Drunkard
- Golden Joker
- Bull
- To the Moon
- Acrobat
- Rough Gem
- Bloodstone
- Arrowhead
- Onyx Agate
- Seeing Double
- The Duo
- The Trio
- The Order
- The Tribe
- Bootstraps

## 已实装礼品卡
- The Fool
- The Magician
- The Emperor
- The Hermit
- Strength
- The Hanged Man
- Death
- The Tower
- The Star
- The Moon
- The Sun
- The World
- Judgement

## 暂未实装：描述不明确或依赖未建系统
### 礼品卡
- The High Priestess：依赖“Planet / 行星牌”系统
- The Empress：`Mult Card` 的 Roshambo 对应强化未定义
- The Hierophant：`Bonus Card` 的 Roshambo 对应强化未定义
- The Lovers：`Wild Card` 的 Roshambo 对应强化未定义
- The Chariot：`Steel Card` 的 Roshambo 对应强化未定义
- Justice：`Glass Card` 的 Roshambo 对应强化未定义
- The Wheel of Fortune：依赖卡牌 edition（Foil/Holographic/Polychrome）系统
- Temperance：依赖“sell value / 售价”系统
- The Devil：`Gold Card` 的 Roshambo 对应强化未定义

### 卡套
- Rank / Face Card / Ace / King / Queen / Jack / 2-10 依赖类：
  - 当前 Roshambo 手牌只有 3 格元素，没有扑克牌点数/人头牌层
  - 代表项：Fibonacci、Scary Face、Even Steven、Odd Todd、Scholar、Business Card、Baron、Photograph、Smiley Face、Triboulet
- Tarot / Planet / Spectral / Booster Pack / Skip / Blind / Boss 依赖类：
  - 当前未建立对应库存、掉落、Boss 规则或跳过关卡系统
  - 代表项：Space Joker、Red Card、Séance、Riff-raff、Superposition、Hallucination、Cartomancer、Astronomer、Chicot、Perkeo
- Sell Value / 邻位复制 / Joker edition 依赖类：
  - 当前特殊牌没有售价成长、左右站位复制、edition 层
  - 代表项：Gift Card、Swashbuckler、Blueprint、Brainstorm、Showman、Baseball Card
- 动态手牌大小 / 精确 4 张牌 / 扑克牌数量依赖类：
  - 当前 Roshambo 每次出牌固定为 1 张 3 格卡，不存在 4 张/5 张 poker hand
  - 代表项：Mad Joker、Square Joker、The Family、Stuntman、Turtle Bean、Juggler、Troubadour、Merry Andy

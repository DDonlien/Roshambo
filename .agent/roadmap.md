# Roadmap

## 近期
- SleeveDefinition（卡套）接入：占位符 slot 限制、结算钩子（score/reward/interest）
- GiftCardDefinition（兑奖券）接入：一次性立即生效/下一回合生效两种时机
- FX Lab：在项目内提供可视化挑选 GSAP 预制动效与参数的页面
- 补完未覆盖的 Balatro 映射系统：点数/人头牌、Boss 关卡、塔罗/行星/异象、sell value、edition/enhancement
- 将商店进一步表驱动：pack 类型、pack 数量、card 池权重、shop 刷新/折扣/库存扩展

## 中期
- 特殊牌系统扩展：增加统一事件钩子（回合开始/结算/通关/商店）与可测试的效果管线
- 平衡与数据工具：定义文件校验脚本完善、关卡/经济调参流程
- UI/UX：商店与奖励页更像“小丑牌”的动效与信息密度

## 长期
- 解锁系统：统一进度、成就、解锁条件表达式（unlockRef -> 条件 DSL）
- 视觉升级：在保持 DOM UI 的前提下，引入可选的 Canvas 粒子层（或评估 Pixi/Rive 的混合方案）

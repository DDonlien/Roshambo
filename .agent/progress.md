# Progress

## 当前状态
- Web 端（`ts/`）可运行：TypeScript + DOM + GSAP，Vite 构建
- 配置集中在 `ts/public/definition/`（levels/initial/assets/deck/sleeve/giftcard）
- 已接入：27 关卡流程、奖励结算页与商店页、特殊牌展示与购买、三色格与击穿翻倍、回合收入等

## 最近完成
- 统一配置目录：CSV/JSON 迁移至 `ts/public/definition/`，并更新加载路径
- deckdefinition 接入：卡组选择由定义文件驱动，支持新增特殊卡组
- 新规则：三色格（TRICOLOR）与击穿翻倍计分；回合结束按剩余手牌发钱
- 新流程：ROUND_REWARD -> SHOP -> 下一关/通关
- 2026-04-16T00:00:00+08:00 添加子工程 agent 规范：`ts/agent.md`（TS+GSAP）与 `godot/agent.md`（Godot C#）
- 2026-04-16T00:10:00+08:00 优化滚轮翻转交互：持续同向滚动不重复翻转，需换向或停 0.5s 再触发
- 2026-04-17T00:55:00+08:00 `ts/` 接入卡套/礼品卡主链：商店可购买 Special/Sleeve/Gift Card，卡套被动生效，礼品卡进入库存并可在对局中使用；同步补充覆盖清单与 requirement
- 2026-04-17T01:25:00+08:00 `ts/` 商店重构：移除 Special 出售，改为 sleeve/gift card/card 三类；支持 direct 与 pack（2/3 选 1），新增 shopdefinition 与永久牌库模板

## 阻塞项
- 暂无

## 下一步
- 将 Sleeve（卡套）与 Gift Card（兑奖券）从“定义+加载框架”接入实际玩法与 UI
- 建立 FX 预览/选择页面（GSAP 预制动效库 + 可调参数面板）
- 完善解锁条件（unlockRef）从占位升级为可组合条件/进度系统

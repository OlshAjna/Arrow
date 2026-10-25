# 益智箭

基于 Cocos Creator 3.8.6 与 TypeScript 的折线箭头解谜游戏。

玩家点击箭头后，系统从箭头尖端沿实际移动方向发射射线。路径畅通时整条折线沿原路径滑出并消除；碰到墙体或其他线条时退回并扣除生命。清除全部可移动箭头即可通关。

## 当前版本

- 可直接打开的 Cocos 场景：`assets/scenes/Main.scene`
- 普通、固定、反转箭头
- 长折线与短箭头混合关卡
- 墙体、其它线条及自身折返阻挡
- 生命、提示、重置、胜负和星级结算
- JSON 关卡清单、关卡解锁和历史最高星级存储
- 17 项成员核心算法测试及整合后的关卡/进度测试

## 快速开始

1. 使用 Cocos Creator 3.8.6 打开项目根目录。
2. 等待资源导入完成。
3. 打开 `assets/scenes/Main.scene`。
4. 点击预览即可运行。

命令行检查：

```powershell
pnpm typecheck
pnpm validate:levels
pnpm test:domain
```

## 关卡

- `iter3-demo-01`：短箭头回归关，同时包含普通、固定、反转箭头。
- `long-maze-01`：24 条长折线迷宫关。

关卡入口位于 `assets/resources/levels/level-manifest.json`，新增关卡只需增加 JSON 和清单记录。

## 文档

- [模块开发文档](docs/模块开发文档.md)
- [部署说明](docs/部署说明.md)
- [代码规范](docs/代码规范.md)
- [团队代码整合说明](docs/团队整合说明.md)
- [系统设计总说明书（原迭代设计）](docs/系统设计总说明书.docx)

# Arrow

基于 Cocos Creator 3.x 与 TypeScript 的网格方向箭头解谜游戏。

## 项目简介

玩家点击网格中的箭头，使其沿指定方向移动。路径畅通时箭头滑出屏幕并消除，遇到墙体或其他箭头时退回原位。消除全部可移动箭头即可通关。

## 当前内容

- 分层工程结构与 Cocos 组件入口
- 普通、固定、反转箭头及路径阻挡检测
- JSON 驱动的关卡配置与可解性测试
- 关卡解锁、进度和最高星级本地存储
- 模块开发、代码规范与微信小游戏部署文档

## 快速开始

1. 使用 Cocos Creator 3.8.x 打开项目根目录。
2. 在 `Canvas` 下创建 `GameRoot` 节点并挂载 `GameManager`。
3. 运行预览。

命令行校验：

```powershell
npm run validate:levels
npm run test:domain
```

## 文档

- [模块开发文档](docs/模块开发文档.md)
- [部署说明](docs/部署说明.md)
- [代码规范](docs/代码规范.md)
- [系统设计总说明书](docs/系统设计总说明书.docx)

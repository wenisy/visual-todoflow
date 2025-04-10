# Visual TodoFlow

## 项目描述
Visual TodoFlow 是一个基于 Next.js 的 Web 应用，用于可视化任务流管理。它允许用户通过拖拽节点（如文本、图片和附件）创建和编辑流程图，支持用户认证、待办事项列表和数据保存功能。该应用结合了 React Flow 和 Ant Design，提供交互式界面，帮助用户组织工作流程和任务。

## 特性
- **可视化编辑器**：使用 React Flow 构建的拖拽式节点编辑器，支持添加文本、图片、附件和社交节点。
- **用户认证**：集成登录模态框和认证钩子，确保数据安全。
- **待办事项管理**：包含 TodoList 组件，用于管理任务列表。
- **数据持久化**：支持本地存储和服务器同步，自动保存和加载流程图。
- **UI 组件**：使用 Ant Design 提供美观的用户界面，包括按钮、下拉菜单和模态框。

## 技术栈
- **框架**：Next.js（支持服务器端渲染）
- **前端库**：React, React Flow
- **UI 库**：Ant Design
- **语言**：TypeScript
- **其他**：Local Storage for 数据缓存，Fetch API for 服务器通信

## 安装指南
1. 确保您已安装 Node.js 和 npm。
2. 克隆仓库：`git clone https://github.com/your-repo/visual-todoflow.git`
3. 进入项目目录：`cd visual-todoflow`
4. 安装依赖：`npm install`
5. 运行开发服务器：`npm run dev`

## 使用指南
1. 启动应用后，访问 `http://localhost:3000`。
2. 如果未登录，系统会提示登录。
3. 在左侧边栏拖拽节点到画布，连接节点创建流程。
4. 编辑节点内容，保存流程图到本地或服务器。
5. 查看和管理待办事项列表。

## 贡献指南
- Fork 本仓库。
- 创建您的分支：`git checkout -b feature/your-feature`
- 提交更改：`git commit -m 'Add some feature'`
- 推送分支：`git push origin feature/your-feature`
- 提交 Pull Request。

## 许可
MIT License

© 2025 Visual TodoFlow 项目团队

# CloudSpace - 个人文件管理系统

一个功能强大的个人文件管理系统，支持文件上传、预览、分享和管理员功能。

## 功能特性

### 文件管理
- ✅ 拖拽上传文件
- ✅ 支持多种文件类型：图片、视频、音频、文档
- ✅ 文件分类管理
- ✅ 文件预览功能
- ✅ 公开分享链接（带token）

### 文档预览
- ✅ 图片、视频、音频直接预览
- ✅ 代码文件语法高亮（支持40+种语言）
- ✅ Markdown渲染
- ✅ CSV表格渲染
- ✅ PDF在线预览
- ✅ 文本文件预览

### 用户管理
- ✅ 用户注册/登录
- ✅ 修改密码功能
- ✅ 管理员权限系统

### 管理员功能
- ✅ 用户管理（查看、封禁、删除）
- ✅ 查看所有用户文件
- ✅ 删除任意文件
- ✅ 为任意文件生成分享链接

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite
- **文件上传**: Multer
- **认证**: bcrypt + express-session
- **前端**: 原生 JavaScript + HTML + CSS
- **代码高亮**: Highlight.js
- **PDF预览**: PDF.js
- **Markdown渲染**: Marked.js

## 部署指南

### 1. 环境要求
- Node.js 14+
- PM2 (全局安装)

### 2. 安装依赖
```bash
npm install
```

### 3. 启动服务

#### 开发环境
```bash
node server.js
```

#### 生产环境 (使用PM2)
```bash
# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs cloudspace

# 重启
pm2 restart cloudspace

# 停止
pm2 stop cloudspace
```

### 4. 访问应用
默认端口: `http://127.0.0.1:7529`

### 5. 默认管理员账号
- 用户名: `root`
- 密码: `root`

**⚠️ 重要：首次登录后请立即修改密码！**

## 项目结构

```
.
├── server.js              # 主服务器文件
├── database.js            # 数据库初始化
├── migrate.js             # 数据库迁移
├── routes/
│   ├── auth.js           # 认证路由
│   ├── files.js          # 文件管理路由
│   └── admin.js          # 管理员路由
├── public/
│   ├── index.html        # 主页面
│   ├── app.js            # 前端逻辑
│   ├── style.css         # 样式文件
│   └── preview-helper.js # 预览辅助函数
├── uploads/              # 文件存储目录
├── logs/                 # 日志目录
└── ecosystem.config.js   # PM2配置文件
```

## 文件存储结构

```
uploads/
└── {username}/
    ├── images/
    ├── videos/
    ├── audio/
    └── documents/
```

## API 端点

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/change-password` - 修改密码

### 文件管理
- `POST /api/files/upload` - 上传文件
- `GET /api/files` - 获取文件列表
- `GET /api/files/:id/content` - 下载文件
- `GET /api/files/:id/view` - 查看文件（支持token）
- `POST /api/files/:id/share` - 生成分享链接
- `DELETE /api/files/:id` - 删除文件

### 管理员
- `GET /api/admin/users` - 获取所有用户
- `PUT /api/admin/users/:id/ban` - 封禁/解封用户
- `DELETE /api/admin/users/:id` - 删除用户
- `GET /api/admin/users/:id/files` - 获取用户文件
- `GET /api/admin/files/:id/content` - 下载任意文件
- `GET /api/admin/files/:id/view` - 查看任意文件
- `DELETE /api/admin/files/:id` - 删除任意文件

## 安全建议

1. 修改默认管理员密码
2. 使用环境变量存储敏感信息
3. 配置防火墙规则
4. 定期备份数据库
5. 使用 HTTPS（配置反向代理）
6. 限制文件上传大小

## 许可证

MIT

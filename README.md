# Notice Note

一个本地桌面笔记应用，支持 Markdown 记录、实时预览和多个提醒时间。提醒到点后会通过电脑端系统通知提示。

## 项目结构

```text
notice_note_client_pc/   Windows 桌面客户端
notice_note_client_app/  Android 客户端及原生工程
notice_note_server/      独立移动接口服务
release/                 统一构建产物目录
```

## 启动命令

```powershell
npm install
npm run start:pc
npm run start:server
npm run start:app
```

- `start:pc`：启动 Electron 桌面客户端。
- `start:server`：启动独立移动接口服务。
- `start:app`：构建并运行 Android 客户端，需要已连接设备或模拟器。

独立服务直接由 Node.js 运行，不需要额外打包。

## 打包命令

```powershell
npm run build:pc
npm run build:app
npm run build:all
```

产物统一输出到：

```text
release/pc/   Windows 安装包
release/app/  Android APK
```

## 功能

- 新建、编辑、删除本地笔记
- 正文使用类 Obsidian Live Preview：非当前行隐藏 Markdown 符号，光标所在行显示源码
- 每条笔记可添加多个提醒时间
- 可一键自动添加明天、下周、下个月三次提醒，默认时间为 09:30，支持在界面中修改
- 提醒添加和自动提醒设置集中在“配置”弹窗中
- 提醒触发后自动标记为已提醒
- 可在界面左下角自定义 `notes.json` 保存位置
- 默认笔记数据保存到 Electron 的 `userData` 目录中

## 自定义保存位置

应用左下角会显示当前保存路径。点击“更改位置”可以选择新的 `notes.json` 文件：

- 如果选择的文件已经存在，应用会读取该文件中的笔记。
- 如果选择的文件不存在，应用会把当前笔记写入新文件。
- 点击“默认”可以恢复到系统默认保存位置。

## 开发检查

```powershell
npm run lint
npm audit --omit=dev
```

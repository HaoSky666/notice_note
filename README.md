# Notice Note

一个本地桌面笔记应用，支持 Markdown 记录、实时预览和多个提醒时间。提醒到点后会通过电脑端系统通知提示。

## 项目结构

```text
notice_note_client_pc/   Windows 桌面客户端
notice_note_client_app/  Android 客户端及原生工程
notice_note_server/      移动接口服务的独立实现（当前无需单独运行）
release/                 统一构建产物目录
```

## 启动命令

```powershell
npm install
npm run start:pc
npm run start:app
```

- `start:pc`：启动 Electron 桌面客户端，同时启动移动接口服务；退出 PC 客户端时服务会自动停止。
- `start:app`：构建并运行 Android 客户端，需要已连接设备或模拟器。

## EasyTier 手机连接

1. 在电脑和手机上安装 EasyTier。
2. 两台设备加入同一个 EasyTier 网络，并确认能够通过虚拟 IPv4 互相访问。
3. 运行 `npm run start:pc` 启动 PC 客户端，移动接口服务会随应用一起启动。
4. 在 PC 客户端点击手机扫码按钮，二维码会使用电脑的 EasyTier IPv4 地址。
5. 手机扫码后即可通过 EasyTier 网络访问笔记。

服务默认只监听自动检测到的 EasyTier IPv4 和 `39271` 端口；检测不到时仅监听 `127.0.0.1`。自动识别名称包含 `EasyTier` 或以 `et_`、`et-` 开头的网卡。如果网卡名称无法识别，可以手动指定：

```powershell
$env:NOTICE_NOTE_EASYTIER_IP='10.144.144.1'
npm run start:pc
```

还可以通过 `NOTICE_NOTE_MOBILE_HOST` 覆盖移动服务的监听地址。服务固定使用 `39271` 端口，并直接复用 PC 客户端已经加载的笔记数据。

如果手机已加入同一 EasyTier 网络但仍无法连接，请使用管理员 PowerShell 为当前 EasyTier 地址放行服务端口：

```powershell
New-NetFirewallRule -DisplayName 'Notice Note EasyTier' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 39271 -LocalAddress 10.144.144.1
```

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

# Presence Studio · Discord Custom RPC

一个零第三方运行时依赖的本地 Rich Presence 服务，提供中文网页编辑器和即时预览。需要 Node.js 22+ 和已登录的 Discord 桌面客户端。

## 启动

```sh
npm start
```

打开 http://127.0.0.1:3210 。也可以双击 macOS 的 `启动.command`。终端 Ctrl+C 退出；网页停用按钮只清除 Presence，不停止网页服务。关闭网页不停止发布。服务重启会保留草稿，但需重新点击启用。

更换端口：`PORT=3211 npm start`。明确禁止 8000、8188；仅监听 127.0.0.1，不对局域网开放。

## 首次使用

1. 在 https://discord.com/developers/applications 创建应用，复制 Application ID。
2. 打开并登录 Discord 桌面客户端，在活动隐私设置中允许分享活动。
3. 网页填入 ID，编辑参数并点击启用。无需 Bot Token、用户 Token 或 Client Secret。
4. 只有 Discord 返回 SET_ACTIVITY 确认才显示「已确认更新」。客户端断开时每 5 秒尝试重连，恢复最后一次应用的内容。保存草稿不会替换正在发布的内容。

## 编辑范围

- 活动类型：Playing、Listening、Watching、Competing；Streaming 提供实验性选项。
- Details / State 文本和点击链接，成员列表显示字段。
- 开始 / 结束时间（JSON 使用 Unix 毫秒）。
- 大小图片 URL / 上传素材 Key、悬停文字、图片点击链接、邀请封面。
- 最多两个按钮：文字和 HTTP(S) 链接。
- Party ID、人数、上限、隐私；join / spectate / match secret、instance。
- 实验性 name 覆盖；应用名称通常取自 Developer Portal。
- 本地草稿保存、JSON 编辑及校验、文件导入导出。

## 客户端限制

本工具使用本地 RPC SET_ACTIVITY。Gateway Activity 对象并不等于所有字段均可由 RPC 写入：Custom Status（type 4）及 Emoji、created_at、application_id、flags 等不能作为任意可写参数。Application ID 通过握手设置。部分客户端会忽略直播类型、名称覆盖、链接、邀请封面或部分高级字段；收到更新确认不保证每个字段都渲染。

预览是近似布局，无法复现所有 Discord 版本。应用素材 Key 使用占位图；公开图片 URL 可直接预览。邀请封面不显示于个人资料。自己的资料可能不显示自己的按钮，可由其他账号查看验证。Secrets 仅传输元数据，本工具未实现游戏加入 / 观战事件处理。

数据保存在 `data/config.json`，包含配置中的链接及 secrets；文件权限为 0600，已排除 Git。导出文件同样包含这些字段。服务只接受本机 Host / Origin，拒绝跨站写入。不使用账户凭据。

## 验证

```sh
npm test
```

测试覆盖参数校验、IPC 分帧 / 心跳 / 请求响应 / 错误 / 清除、HTTP 同源保护、持久化及禁用端口。模拟 IPC 不等于真实 Discord 发布验证；实际发布需要有效 Application ID。

参考官方文档：
- https://docs.discord.com/developers/topics/rpc
- https://docs.discord.com/developers/events/gateway-events#activity-object

## 界面与语言 / Interface & language

界面采用网页端 Liquid Glass 风格：支持浅色、深色和跟随系统，半透明面板、玻璃亮边与柔和层次。右上角 `EN / 中文` 切换中英文并记住选择；不会翻译或修改用户填写的 Presence 文本和 JSON。

顶部、底部各 5% 视窗区域使用分层渐进高斯模糊和淡出，内容靠近边缘时纵向放大（最高 1.65 倍）。`边缘效果 / Edge effects` 可关闭并记住选择；输入时保持清晰，系统减少动态效果时自动停用。玻璃效果在不支持 backdrop-filter 的浏览器上退化为半透明面板。

The interface uses a web interpretation of Liquid Glass. Switch between English and Chinese at the top right; your preference is remembered and your activity content is preserved. The top and bottom 5% of the viewport progressively blur, stretch vertically and fade out. Edge effects can be disabled, respect reduced motion, and pause while editing fields.


## 深色模式与实时折射 / Themes & live refraction

右上角主题按钮依次切换「自动 → 浅色 → 深色」，刷新后保留选择。自动模式响应系统主题变化；语言、主题和边缘效果是独立偏好。

折射不再读取固定置换图片。`public/refraction.js` 根据每个玻璃组件的实际尺寸和圆角构造带倒角的厚度表面，计算高度梯度得到表面法线，使用 Snell 定律追踪空气 → 玻璃 → 空气两次折射。RGB 使用 1.514 / 1.522 / 1.534 的折射率模拟色散，再投影到背景采样平面。`public/optics.js` 在组件尺寸改变时生成三个独立 PNG 位移缓冲，交由 SVG 滤镜采样浏览器当前背景。镜头固定为正视角，不使用鼠标跟随或悬停高光。贴图表达玻璃几何形状，浏览器每次合成都会重新采样滚动中的真实背景，因此无需用鼠标驱动贴图变化。

这是几何光学驱动的**屏幕空间模拟**：背景为二维合成图，不具有真实场景深度；没有多次反射、焦散或完整路径追踪。全反射位置采用无偏移采样回退。为控制性能，贴图采用低分辨率并由浏览器插值；更新上限约 30 Hz，只处理可见且发生变化的组件，页面隐藏时停止更新。静止视角下不空转。减少透明度时回退为实色组件。

The theme button cycles through System, Light and Dark and remembers your choice. Live refraction uses component-specific beveled surface normals, two Snell-law interfaces and separate RGB refractive indices. Geometry maps are recomputed on resize; SVG filters continuously sample the actual scrolling backdrop. There is no pointer-following view or light effect. This is a screen-space optical simulation, not a full 3D path tracer. Chromium-based browsers are recommended for SVG backdrop filters; unsupported browsers retain translucent glass styling.

`npm test` includes analytic Snell-law checks, total internal reflection, neutral-index behavior, mirrored normals, RGB dispersion, and view/geometry-dependent map updates in addition to RPC and HTTP tests.


底部操作栏是独立浮动玻璃层，直接使用折射滤镜；前景文字和按钮保持清晰。父级编辑区不再创建 backdrop-filter 隔离层，避免阻断背景采样。以实际滚动文字和输入框轮廓穿过操作栏边缘后的弯曲来验证渲染，而不以贴图更新次数作为视觉生效证据。

视觉依据：[Apple — Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)，重点为背景内容的透镜变形、边缘折射和前景层次。

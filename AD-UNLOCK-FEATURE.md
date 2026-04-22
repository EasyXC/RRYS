# 广告解锁功能 - 实现总结

## 功能说明
用户点击网站任意位置 → 弹出广告弹窗 → 观看5秒后自动关闭 → 显示"感谢您的支持" → 用户获得24小时全站免费访问权限。

## 新建文件

### 1. `src/components/AdUnlockModal.tsx`
广告弹窗组件：
- 深色科技风 UI（橙红渐变主题）
- 两个阶段：`ad`（广告+倒计时）→ `thanks`（感谢语）
- 广告内容区（支持嵌入真实广告 iframe URL，留空则显示模拟占位）
- 底部圆形倒计时 + 橙色进度条
- 解锁成功后 `localStorage` 写入 `expiresAt`，24小时有效
- 感谢语显示3秒后自动消失

### 2. `src/lib/useAdUnlock.ts`
广告解锁状态管理 Hook：
- `isUnlocked`：检查 localStorage 中 `ad_unlock` 是否过期
- `trigger()`：触发弹窗（会话内只触发一次）
- `modal`：通过 React Portal 挂载到 `document.body`
- 每60秒检查一次是否过期，过期自动清除状态

## 修改文件

### 3. `src/components/PageLayout.tsx`
- 导入并使用 `useAdUnlock` Hook
- 添加全局 `click` 监听（延迟3秒后生效，避免首屏加载触发）
- 忽略 `BUTTON / A / INPUT / TEXTAREA / SELECT` 等元素点击
- 忽略广告弹窗自身区域点击

### 4. `src/app/layout.tsx`
新增变量和配置：
- `enableAdUnlock`、`adUnlockAdUrl`、`adUnlockCountdownSeconds`
- 支持从数据库配置（`config.SiteConfig`）读取，也支持环境变量

### 5. `src/lib/config.ts`
- 添加 `SiteConfig.EnableAdUnlock`（默认 false）
- 添加 `SiteConfig.AdUnlockAdUrl`（默认 ''）
- 添加 `SiteConfig.AdUnlockCountdownSeconds`（默认 5秒）

### 6. `src/app/admin/page.tsx`
- SiteConfig 接口新增三个字段
- 管理后台新增「广告解锁配置」面板（开关 + 广告URL + 倒计时秒数）
- 支持数据库配置持久化

## 启用方式

### 方式一：环境变量（适合本地开发）
```env
NEXT_PUBLIC_ENABLE_AD_UNLOCK=true
NEXT_PUBLIC_AD_UNLOCK_AD_URL=           # 可留空，默认显示模拟广告
NEXT_PUBLIC_AD_UNLOCK_COUNTDOWN_SECONDS=5
```

### 方式二：管理后台（适合已部署环境）
1. 登录管理后台
2. 进入「站点设置」
3. 展开「广告解锁配置」
4. 开启开关，填写广告 URL（可选），设置倒计时秒数
5. 点击「保存」

## 广告来源配置
- 留空 `AdUnlockAdUrl` → 显示内置模拟广告（可用于测试效果）
- 填入广告联盟 iframe 地址 → 显示真实广告
- 支持：Google AdSense、百度推广、腾讯广告、任何支持 iframe 嵌入的广告

## 注意事项
- 广告 URL 建议使用 HTTPS，否则浏览器可能阻止嵌入
- 需遵守各广告平台的「激励视频」或「可跳过广告」政策
- 24小时有效期基于本地时间，可通过清除浏览器 localStorage 重置

# 今天吃啥 H5 / PWA 版

这是一个可以部署到 GitHub Pages 的静态网页 App。

## 上传 GitHub Pages

1. 注册 GitHub 账号
2. 新建仓库，例如 `today-eat`
3. 上传本压缩包解压后的全部文件
4. 进入仓库 `Settings` → `Pages`
5. Source 选择 `Deploy from a branch`
6. Branch 选择 `main`，Folder 选择 `/root`
7. 保存，等待生成网址
8. 手机浏览器打开网址
9. 添加到主屏幕

## 数据说明

数据保存在当前浏览器本地 localStorage 里。

换手机、换浏览器、清缓存之前，请先进入：

DeepSeek → 数据备份 / 恢复 → 生成备份数据 → 复制保存

图片在这个 PWA 版本里会转成 base64 存在备份里，比微信小程序版更容易转移。


## V2 更新

- 底部工具栏 `DeepSeek` 已简化为 `AI`。


## V3 更新

- 底部工具栏 `DeepSeek` 简化为 `AI`。
- 更新离线缓存版本，上传 GitHub Pages 后手机端更容易刷新到新版。

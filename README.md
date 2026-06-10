# 今天吃啥 H5 / PWA 版

这是一个可以部署到 GitHub Pages 的静态网页 App。

## 重要说明（这版专门修复安装图标问题）
这次图标文件已经放在项目根目录，不需要再上传 icons 文件夹。

你上传到 GitHub 时，请删除仓库旧文件后，把本压缩包解压后的**全部文件**重新上传。
尤其要确认下面这些文件都在仓库最外层能看到：

- index.html
- app-v5.js
- style-v5.css
- manifest.json
- manifest.webmanifest
- service-worker.js
- icon-192.png
- icon-512.png
- apple-touch-icon.png

## GitHub Pages
1. 打开你的仓库
2. 先备份数据（如果需要）
3. 删除旧文件
4. 上传本压缩包解压后的全部文件
5. 等待 GitHub Pages 更新
6. 手机打开网址：`https://你的用户名.github.io/Today-eat/?v=5.12`

## 数据说明
数据保存在当前浏览器 localStorage。
清缓存前，请先到：
AI → 数据备份 / 恢复 → 生成备份数据 → 复制保存

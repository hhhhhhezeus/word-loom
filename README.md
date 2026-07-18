# 拾词 Word Loom

一个帮助中文用户随手收集、自动整理和复习英语单词的网页应用。

## 在线使用

[打开拾词 Word Loom](https://hhhhhhhezeus.github.io/word-loom/)

无需注册。单词数据保存在当前浏览器的 `localStorage` 中，不会上传到服务器。

## 功能

- 自动将复数、过去式、`-ing` 等形式还原为原形
- 自动查询音标、词性、中英文释义和例句
- 浏览器内置英语发音
- 按学习状态筛选、搜索、编辑与删除词条
- 翻卡式每日复习，可标记“还不熟”或“已掌握”
- 响应式界面，支持电脑、平板和手机

## 本地开发

需要 Node.js 22 或更高版本。

```bash
npm install
npm run dev
```

打开 `http://localhost:3000` 即可使用。

## 部署

`.github/workflows/deploy-pages.yml` 会在代码推送到 `main` 分支后自动构建并发布到 GitHub Pages。

在线词典数据来自 [Free Dictionary API](https://dictionaryapi.dev/)，中文翻译使用 [MyMemory](https://mymemory.translated.net/)。第三方服务暂时不可用时，应用会显示可编辑的备用词条。

## 技术栈

Next.js 16、React 19、TypeScript、GitHub Actions、GitHub Pages。

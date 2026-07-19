# Floating Guess Assistant / 悬浮猜词助手

Floating Guess Assistant is an AI assistant for livestream guessing games.  
用户上传直播截图后，系统会使用视觉 AI 自动读取题目线索、历史猜测和相似度，并给出候选答案。

The user uploads a livestream screenshot, and the system uses Vision AI to extract clues, previous guesses, similarity scores, and suggest possible answers.  
适合直播猜词、相似度猜词、截图分析等场景。

## Current Version / 当前版本

Web Demo v1

## Features / 核心功能

- Upload a livestream screenshot and analyze it with one click  
  上传直播截图并一键读图分析

- Vision AI extracts clues, previous guesses, and similarity scores  
  视觉 AI 自动识别题目线索、历史猜测和相似度

- AI returns candidate answer cards  
  AI 返回候选答案卡片

- Automatically filters out words that have already been guessed  
  自动排除已经猜过的词

- Refine analysis with new clues  
  支持补充新线索后重新分析

- Refine analysis with high-score guesses and similarity scores  
  支持补充高分词和相似度后重新分析

- Temporary memory for supplemental information during the current round  
  补充信息会在当前题目中临时记忆

- Clear all current-round data with one click  
  支持一键清空，进入下一题

- Chinese / English language toggle  
  支持中文 / English 页面切换

- Local autosave and restore  
  本地自动保存和恢复输入状态

- Advanced OCR backup mode  
  高级备用 OCR 功能

- Manual input and local analysis mode  
  高级手动输入 / 本地分析功能

## How to Use / 使用流程

### English

1. Open the Web Demo page.
2. Click **Choose screenshot**.
3. Upload the current livestream guessing screenshot.
4. Click **Analyze screenshot**.
5. Review the AI candidate answers.
6. If new clues or high-score guesses appear:
   - Enter the new clue.
   - Enter the high-score guess and similarity score.
   - Click **Refine analysis**.
7. Click **Clear for next round** when starting a new question.

### 中文

1. 打开 Web Demo 页面。
2. 点击 **选择直播截图**。
3. 上传当前直播猜词截图。
4. 点击 **一键读图猜答案**。
5. 查看 AI 候选答案。
6. 如果有新线索或高分词：
   - 输入新线索。
   - 输入高分词和相似度。
   - 点击 **补充信息再分析**。
7. 进入下一题时，点击 **清空，准备下一题**。

## Project Structure / 项目结构

```text
web-demo/
  index.html
  style.css
  app.js
  data/
    wordBank.json
  js/
    ai.js
    config.js
    dom.js
    events.js
    i18n.js
    localAnalysis.js
    main.js
    ocr.js
    ocrCrop.js
    ocrReport.js
    parser.js
    render.js
    scoring.js
    state.js
    storage.js
    ui.js
    wordBank.js

backend/
  server.js
  package.json
  .env.example
```

## Frontend / 前端说明

The frontend is located in:

前端位于：

```text
web-demo/
```

Main entry files:

主要入口文件：

```text
web-demo/index.html
web-demo/app.js
```

The frontend handles:

前端主要负责：

- Page UI  
  页面 UI

- Chinese / English language toggle  
  中文 / English 语言切换

- Image upload and compression  
  图片上传和压缩

- Calling the backend Vision AI API  
  调用后端视觉 AI 接口

- Rendering AI candidate answer cards  
  显示 AI 候选答案卡片

- Supplemental refinement analysis  
  补充信息再分析

- Local autosave and restore  
  本地保存和恢复输入状态

- Advanced OCR backup tools  
  高级 OCR 备用功能

- Manual input and local analysis tools  
  高级手动输入功能

## Backend / 后端说明

The backend is located in:

后端位于：

```text
backend/
```

Main API endpoints:

主要接口：

```text
POST /api/analyze-image
POST /api/analyze
```

### POST /api/analyze-image

This endpoint receives a screenshot and uses a vision model to analyze the image.

该接口用于上传截图并调用视觉模型分析图片。

It is responsible for:

主要负责：

- Receiving the compressed image from the frontend  
  接收前端压缩后的图片

- Calling the vision model  
  调用视觉模型

- Extracting clues, previous guesses, and candidate answers  
  提取题目线索、历史猜测和候选答案

- Filtering out already-guessed candidate words  
  过滤已经猜过的候选词

### POST /api/analyze

This endpoint analyzes text clues, previous guesses, and supplemental information.

该接口用于根据文本线索、历史猜测和补充信息重新分析。

It is responsible for:

主要负责：

- Receiving clues and previous guesses  
  接收线索和历史猜测

- Calling the text model  
  调用文本模型

- Returning new candidate answers  
  返回新的候选答案

- Filtering out already-guessed words  
  过滤已经猜过的词

## Environment Variables / 环境变量

The backend requires a `.env` file inside the `backend/` folder.

后端需要在 `backend/.env` 中配置：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat

ZHIPU_API_KEY=your_zhipu_api_key_here
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4/
ZHIPU_VISION_MODEL=glm-4v-flash

PORT=3000
```

Do not commit your real `.env` file to GitHub.  
不要把真实 `.env` 提交到 GitHub。

## Local Development / 本地运行

Start the backend:

启动后端：

```bash
cd backend
npm install
npm run dev
```

Open the frontend directly:

前端可以直接打开：

```text
web-demo/index.html
```

Or deploy the frontend to GitHub Pages.

也可以把前端部署到 GitHub Pages。

## Backend URL / 前端后端连接

The frontend backend URL is configured in:

前端后端地址配置在：

```text
web-demo/js/config.js
```

Example:

示例：

```javascript
export const APP_CONFIG = {
  backendUrl: "https://your-backend-url.example.com"
};
```

For local development:

本地开发时可以使用：

```javascript
export const APP_CONFIG = {
  backendUrl: "http://localhost:3000"
};
```

When using Codespaces or online deployment, replace it with the corresponding backend URL.

使用 Codespaces 或线上部署时，需要换成对应的后端地址。

## Limitations / 当前限制

- The Web version cannot automatically capture the livestream app screen. Users need to upload screenshots manually.  
  Web 版不能自动截取直播 App 画面，需要用户手动截图并上传。

- Vision AI analysis speed depends on image size and model response time.  
  视觉 AI 分析速度取决于图片大小和模型响应速度。

- If the livestream screenshot is blurry, the model may misread the content.  
  直播截图太模糊时，模型可能识别错误。

- OCR is only a backup option. The recommended main workflow is Vision AI.  
  OCR 功能只是备用方案，主流程推荐使用视觉 AI。

- The current version is a Web Demo, not an Android floating-window app.  
  当前版本是 Web Demo，不是 Android 悬浮窗版本。

## Roadmap / 下一阶段计划

- Test with more real livestream screenshots  
  测试更多真实直播截图

- Continue optimizing the vision prompt  
  继续优化视觉提示词

- Continue improving image compression and analysis speed  
  继续优化图片压缩和分析速度

- Deploy a stable backend service  
  部署稳定后端服务

- Start the Android APK version  
  开始 Android APK 版本

- Future support for floating window and automatic screenshot analysis  
  未来支持悬浮窗和自动截图分析

## Status / 开发状态

Web Demo v1 is mostly complete. The current focus is stability testing and deployment preparation.

Web Demo v1 已基本完成，当前重点是稳定性测试和部署准备。
# Floating Guess Assistant

Floating Guess Assistant is a personal CS learning project for building an AI-assisted word guessing tool.

The project started as a simple web demo and is gradually evolving into a complete assistant with local rule-based scoring, AI analysis, structured candidate cards, follow-up analysis, and future OCR / Android support.

## Current Status

The current version is a web-based AI guessing assistant.

It supports:

- Manual clue input
- Guess history with similarity scores
- Temporary candidate word list
- Local rule-based scoring
- Top 5 local candidate results
- Confidence percentage
- Scoring explanation logs
- JSON import and export
- Browser localStorage autosave
- AI prompt generation
- Backend AI analysis through DeepSeek API
- Structured AI candidate cards
- AI candidate keywords
- Confidence bars
- Top 5 / Top 10 AI card display
- AI card search
- Add AI candidate to temporary word list
- Use AI candidate as a guess
- Candidate follow-up prompt generation
- Direct backend follow-up analysis
- Follow-up history
- Delete follow-up history records
- Modular frontend JavaScript structure
- OCR crop presets and drag selection
- OCR preprocessing and preprocessing preview
- Multi-region OCR for hint region and guess region
- One-click OCR + AI analysis flow
- OCR debug report generation and download

## Project Structure

```text
floating-guess-assistant/
  index.html
  README.md

  web-demo/
    index.html
    style.css
    app.js

    data/
      wordBank.json

    js/
      storage.js        # localStorage helper functions
      parser.js         # OCR text parsing and input parsing
      scoring.js        # local scoring and confidence logic
      localAnalysis.js  # local candidate ranking
      ai.js             # AI prompt builders and backend request helper
      ocr.js            # OCR image cropping/preprocessing/recognition helpers
      ocrCrop.js        # OCR crop coordinate and preset calculations
      render.js         # UI rendering helpers for results and cards
      ocrReport.js      # OCR debug report generation and download helpers
      ui.js             # general UI helpers
      dom.js             # DOM element references
      config.js         # frontend configuration such as backend URL
      wordBank.js       # word bank JSON loading helper
      events.js         # central event listener setup

  backend/
    package.json
    package-lock.json
    server.js
    .env.example
    .gitignore
```

## Web Demo

The web demo is located in:

```text
web-demo/
```

It includes:

```text
index.html
style.css
app.js
data/wordBank.json
```

The frontend can be deployed with GitHub Pages.

## Backend

The backend is located in:

```text
backend/
```

It provides:

```text
POST /api/analyze
```

The frontend sends clues, guess history, and temporary candidates to the backend. The backend calls the AI model and returns:

```json
{
  "prompt": "...",
  "aiText": "...",
  "aiJson": {
    "candidates": [
      {
        "word": "光阴似箭",
        "confidence": 92,
        "reason": "和时间飞逝高度相关",
        "keywords": ["时间", "光阴", "飞逝", "成语"]
      }
    ],
    "nextGuesses": ["时光", "岁月", "日月"],
    "uncertainty": "当前线索较少，需要更多相似度反馈。"
  }
}
```

## Environment Variables

Create a local file:

```text
backend/.env
```

Example:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
PORT=3000
```

Do not commit `.env` to GitHub.

The safe example file is:

```text
backend/.env.example
```

## Run Backend in Codespaces

```bash
cd backend
npm install
npm run dev
```

If port 3000 is already in use:

```bash
pkill node
npm run dev
```

## Intended Use

This project is for personal learning, coursework, and open-source experimentation.

It is intended to help practice:

- HTML
- CSS
- JavaScript
- GitHub
- Node.js
- Express
- API integration
- Prompt engineering
- JSON parsing
- Local storage
- Basic AI product design

It is not intended to violate platform rules, interfere with third-party services, or provide unfair advantages in live interactive events.

## Roadmap

### Phase 1: Web + Rules

Completed:

- Basic web UI
- Manual clue input
- Guess history
- Candidate word bank
- Local scoring
- JSON import/export

### Phase 2: Web + AI

Completed:

- AI prompt generation
- Backend API
- DeepSeek integration
- Structured AI candidate cards
- Follow-up analysis
- Follow-up history

### Phase 3: Web OCR

Planned:

- Upload screenshot
- OCR text recognition
- Fill recognized text into clue input
- Clean OCR text
- Extract guesses and similarity scores

### Phase 4: Android App

Planned:

- Android manual input version
- Android floating window
- Screen capture permission
- OCR on selected screen region
- Floating AI candidate display

## Next Milestone

The next milestone is:

```text
Web OCR v0.1
```

Goal:

```text
Upload image → OCR recognize text → fill clue input → AI analyze
```
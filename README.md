# Floating Guess Assistant

An AI-powered assistant for live word-guessing and semantic similarity games.

Floating Guess Assistant analyzes screenshots, clues, previous guesses, and similarity scores to suggest likely answers. The Android version is designed around a lightweight floating-window workflow so users can request an analysis without repeatedly switching away from the game or livestream.

## Current Version

**Android v0.7.0 — Floating Analysis & Quick Refine**

Current development status:

* Web prototype: functional
* Backend API: deployed
* Native Android app: functional
* Floating overlay: implemented
* Manual screen capture: implemented
* Floating result panel: implemented
* Floating supplemental analysis: implemented
* Release hardening and wider device testing: in progress

> The app does **not** continuously capture the screen. A screenshot is read only after explicit user action.

---

## Core Workflow

```text
Open Floating Guess Assistant
        ↓
Enable floating-window permission
        ↓
Authorize screen capture
        ↓
Enter the game / livestream
        ↓
Tap the FG floating button
        ↓
Capture one screen frame
        ↓
Compress screenshot
        ↓
Send image to AI backend
        ↓
Receive candidate answers
        ↓
Show Top 3 in floating result panel
        ↓
Add new clue / high-score word / similarity
        ↓
Run supplemental analysis
```

The goal is to keep the interaction short enough to be useful during a live guessing game.

---

# Features

## Screenshot Analysis

The Android app can:

* Select an existing screenshot from the device
* Preview the screenshot
* Compress the image before upload
* Send it to the backend for AI analysis
* Parse structured candidate answers
* Display confidence scores
* Display keywords and reasoning
* Store extracted clues and previous guesses

---

## AI Candidate Ranking

Analysis results include:

* Most likely answer
* Ranked candidate list
* Confidence percentage
* Relevant keywords
* Short reasoning
* Top-three candidate quick copy

The highest-ranked candidate is emphasized for faster reading on mobile.

---

## Supplemental Analysis

When new information appears during the game, the user can provide:

```text
New clue
High-score guessed word
Similarity score
```

The assistant combines this information with previous clues and guesses and runs another analysis.

This avoids restarting the entire guessing process every time new information appears.

---

# Floating Window

The Android version includes a draggable `FG` floating button.

Current interactions:

```text
Tap
→ Capture the current screen once and analyze it

Double tap
→ Open the full Android app

Drag
→ Move the floating button

Long press
→ Close the floating session
```

The floating button:

* Can be moved around the screen
* Remembers its previous position
* Snaps toward the screen edge
* Uses a compact semi-transparent design
* Runs through an Android foreground service

---

# Manual Screen Capture

Screen capture is implemented using Android MediaProjection.

The design intentionally avoids continuous screen monitoring.

Instead:

```text
User taps FG
→ one frame is captured
→ the frame is analyzed
→ capture waits for the next user action
```

This reduces unnecessary processing, network requests, and accidental captures.

The MediaProjection session remains available while authorized, but analysis only starts after an explicit user action.

---

# Floating Result Panel — v0.6

v0.6 introduced an overlay result panel so analysis results no longer require immediately returning to the main app.

The floating panel can display:

* Most likely answer
* Confidence
* Top candidate answers
* Short reasoning
* Re-capture action
* Copy-answer action
* Open-full-app action
* Close-result action

The panel itself can also be moved around the screen.

Before taking a new screenshot, floating UI elements are temporarily hidden so they are less likely to appear in the captured image.

---

# Floating Quick Refine — v0.7

v0.7 extends the result panel with direct supplemental analysis.

From the floating result panel, the user can enter:

```text
New clue
High-score word
Similarity %
```

Then run:

```text
Supplemental Analysis
```

without returning to the main app.

The new information is combined with the existing clue and guess history, and the floating candidate results are updated in place.

Selecting a candidate can also pre-fill it as a high-score guess, allowing the user to enter only the observed similarity score.

---

# Main Android App

The full Android interface still provides more detailed controls.

Available functionality includes:

* Screenshot picker
* Screenshot preview
* AI image analysis
* Candidate cards
* Current clue memory
* Guess and similarity memory
* Supplemental analysis
* Raw AI output
* Copy and share actions
* Recent analysis history
* Restore previous results
* Debug log
* Backend health check
* Configurable backend URL
* Floating-window controls
* Screen-capture controls

---

# Local State

The app stores useful state locally using Android `SharedPreferences`.

Examples include:

* Current AI result
* Candidate list
* Clues
* Guess history
* Supplemental inputs
* Recent analysis history
* Backend URL
* Floating button position
* Recent floating-analysis result

This allows the app to preserve useful context between sessions.

---

# Backend

Default backend:

```text
https://floating-guess-backend.onrender.com
```

Main endpoints:

```text
POST /api/analyze-image
POST /api/analyze
```

### `/api/analyze-image`

Used for screenshot-based analysis.

Input:

```text
Screenshot
```

Output includes structured AI analysis such as candidate answers, extracted clues, and guesses.

### `/api/analyze`

Used for supplemental semantic analysis.

Input can include:

```text
Clues
Previous guesses
Similarity scores
Additional user information
```

---

# Android Architecture

Current Android implementation uses:

```text
Kotlin
Jetpack Compose
OkHttp
Android MediaProjection
WindowManager overlays
Foreground Service
SharedPreferences
JSON
```

Main components currently include:

```text
MainActivity
├── Compose UI
├── screenshot selection
├── manual image analysis
├── supplemental analysis
├── history
├── debug tools
└── floating / capture controls

FloatingButtonService
├── floating FG button
├── MediaProjection session
├── single-frame capture
├── screenshot compression
├── backend requests
├── floating result panel
├── quick refine UI
└── foreground-service lifecycle
```

A future refactor may split networking, state management, capture handling, and UI into separate components.

---

# Android Permissions

The current floating-analysis workflow requires:

```text
INTERNET
SYSTEM_ALERT_WINDOW
FOREGROUND_SERVICE
FOREGROUND_SERVICE_MEDIA_PROJECTION
```

MediaProjection itself requires explicit screen-capture authorization from the user.

---

# Build

Open:

```text
android-app/
```

in Android Studio.

Or build from the command line:

```powershell
cd android-app
.\gradlew.bat clean :app:assembleDebug
```

Debug APK output:

```text
android-app/app/build/outputs/apk/debug/app-debug.apk
```

Current development version:

```text
0.7.0
```

---

# Testing Flow

Recommended v0.7 test:

```text
1. Install the APK
2. Open Floating Guess Assistant
3. Enable floating-window permission
4. Authorize screen capture
5. Open a guessing game or test screen
6. Tap FG
7. Confirm that one screenshot is analyzed
8. Confirm floating Top 3 results appear
9. Select a candidate
10. Enter its similarity score
11. Run supplemental analysis
12. Confirm floating results update
13. Add a new clue
14. Analyze again
15. Re-capture the screen
16. Double tap FG to open the full app
17. Long press FG to end the floating session
```

---

# Version History

## v0.3

Native Android analysis workflow.

Major additions:

* Screenshot selection
* AI image analysis
* Candidate cards
* Supplemental analysis
* History
* Debug tools
* Improved mobile result layout

## v0.4

Floating-window prototype.

Major additions:

* Overlay permission
* Floating service
* Draggable FG button
* Edge snapping
* Position persistence
* Floating interaction controls

## v0.5

Manual floating screen capture.

Major additions:

* MediaProjection integration
* User-authorized screen-capture session
* Single-frame capture
* Floating-triggered AI image analysis
* Foreground capture service

## v0.6

Floating result panel.

Major additions:

* Floating Top 3 candidates
* Most-likely-answer display
* Re-capture
* Copy answer
* Open full result
* Movable result card

## v0.7

Floating quick refinement.

Major additions:

* New clue input
* High-score word input
* Similarity input
* Supplemental analysis directly from overlay
* Candidate pre-fill
* In-place floating-result update

---

# Next Milestones

The core feature set is now largely implemented.

Development after v0.7 will focus primarily on reliability and product polish rather than major new functionality.

Planned areas:

### v0.8 — Stability & Refactor

* MediaProjection lifecycle hardening
* Better failure recovery
* Network retry behavior
* Backend cold-start handling
* Service-state synchronization
* Orientation handling
* Code separation and cleanup

### v0.9 — Beta

* Real-device testing
* Android version compatibility testing
* UI refinement
* Signed APK
* Bug fixes
* Beta distribution

### v1.0 — Stable Release

Goal:

```text
Tap FG
→ Capture
→ Analyze
→ See answer
→ Add new information if needed
→ Analyze again
```

with a stable and fast workflow suitable for real usage.

---

# Project Goal

Floating Guess Assistant began as a simple AI helper for live guessing games.

The project has gradually evolved from:

```text
Web prototype
→ Native Android app
→ Floating assistant
→ Manual screen capture
→ Floating AI result interface
→ In-overlay supplemental analysis
```

The main design principle is simple:

**reduce the number of actions required between seeing a new clue and getting a useful AI suggestion.**

---

## Status

**Current development version: Android v0.7.0**

Core functionality is implemented.

Current focus:

**testing, stability, lifecycle handling, and preparing the project for beta use.**

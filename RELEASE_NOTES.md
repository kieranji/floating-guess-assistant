# Floating Guess Assistant - Release Notes

## Android v0.2.0 Debug

### Status
First Android debug APK for real-device testing.

### Main Features
- Native Android app built with Jetpack Compose
- Select screenshot from device
- Preview selected screenshot
- Upload compressed screenshot to Render backend
- AI image analysis
- Display candidate answers
- Display confidence, keywords, and reasoning
- Add new clues manually
- Add guessed words with similarity scores
- Run supplemental AI analysis
- Save current state locally
- Save recent history
- Restore history items
- Copy AI result
- Share AI result
- Debug log panel
- Export full debug information
- Configurable backend URL
- Backend health check button

### Backend
- Render backend connected
- Default backend URL:
  https://floating-guess-backend.onrender.com

### Testing Checklist
- Open app
- Check backend status
- Select screenshot
- Analyze screenshot
- Add new clue
- Add high-score guessed word and similarity
- Run supplemental analysis
- Copy debug information
- Clear current question
- Restart app and check local state persistence

### Known Limitations
- No floating window yet
- No automatic screenshot capture yet
- Requires manual screenshot selection
- Render free backend may sleep before first request
- UI is still debug-oriented

### Next Planned Version
Android v0.3.0:
- Improve result layout
- Add better error messages
- Add floating window entry preparation
- Prepare release APK

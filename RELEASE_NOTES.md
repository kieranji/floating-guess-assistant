## Android v0.4.0 Floating Window Preview

### Status
In development. Basic floating button prototype is ready for real-device testing.

### Main Changes
- Added overlay window permission
- Added overlay permission settings action
- Added floating button service
- Made floating button draggable
- Persisted floating button position
- Added long-press action to close floating button
- Added double-tap action to open app and close floating button
- Improved floating button appearance
- Made floating button semi-transparent
- Added edge snapping
- Improved floating button text styling
- Added protection against duplicate floating button startup

### Testing Checklist
- Install the debug APK on a real Android phone
- Open the app
- Tap "检查 / 开启悬浮窗权限"
- Enable overlay permission in Android settings
- Return to the app
- Tap "启动悬浮按钮"
- Confirm the floating FG button appears
- Drag the floating button
- Confirm it snaps to the left or right screen edge
- Close and restart the floating button
- Confirm it remembers the previous position
- Tap the floating button and confirm it opens the app
- Double-tap the floating button and confirm it opens the app and closes itself
- Long-press the floating button and confirm it closes
- Tap "关闭悬浮按钮" from inside the app

### Known Limitations
- Floating button does not analyze screenshots yet
- No automatic screenshot capture yet
- Floating button only opens the main app
- MediaProjection permission is not implemented yet
- Real-device behavior may differ from emulator behavior
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

## Android v0.3.0 Debug

### Main Changes
- Added top candidate card for faster mobile reading
- Added copy top three candidates action
- Collapsed raw AI result by default
- Collapsed debug log by default
- Fixed Android Manifest XML version issue

### Status
Ready for debug APK testing.
- Improve result layout
- Add better error messages
- Add floating window entry preparation
- Prepare release APK

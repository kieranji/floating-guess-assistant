package com.kieran.floatingguess

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.NotificationCompat
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * v0.7 foreground service.
 *
 * v0.5: user-authorized MediaProjection session + one capture per FG tap.
 * v0.6: compact floating result card with Top 3, retry, copy and open-app actions.
 * v0.7: quick floating refinement with new clue / high-score guess / similarity.
 *
 * The service never captures continuously. A frame is read only after explicit user action.
 */
class FloatingButtonService : Service() {
    private var windowManager: WindowManager? = null

    private var floatingButton: TextView? = null
    private var bubbleLayoutParams: WindowManager.LayoutParams? = null

    private var resultPanel: LinearLayout? = null
    private var resultPanelLayoutParams: WindowManager.LayoutParams? = null
    private var resultStatusText: TextView? = null
    private var topAnswerText: TextView? = null
    private var topReasonText: TextView? = null
    private var candidateContainer: LinearLayout? = null
    private var refineContainer: LinearLayout? = null
    private var refineClueInput: EditText? = null
    private var refineGuessInput: EditText? = null
    private var refineScoreInput: EditText? = null
    private var refineSubmitButton: Button? = null
    private var refineToggleButton: Button? = null

    private var bubbleInitialX = 0
    private var bubbleInitialY = 0
    private var bubbleInitialTouchX = 0f
    private var bubbleInitialTouchY = 0f
    private var bubbleDragging = false
    private var bubbleLongPressTriggered = false
    private var lastTapTime = 0L
    private var pendingSingleTap: Runnable? = null

    private var panelInitialX = 0
    private var panelInitialY = 0
    private var panelInitialTouchX = 0f
    private var panelInitialTouchY = 0f
    private var panelDragging = false
    private var panelYBeforeRefine: Int? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private val bubbleLongPressRunnable = Runnable {
        if (!bubbleDragging) {
            bubbleLongPressTriggered = true
            Toast.makeText(
                this,
                "悬浮会话已关闭。",
                Toast.LENGTH_SHORT
            ).show()
            stopSelf()
        }
    }

    private var mediaProjection: MediaProjection? = null
    private var mediaProjectionCallback: MediaProjection.Callback? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var imageThread: HandlerThread? = null
    private var imageHandler: Handler? = null

    @Volatile
    private var captureRequested = false

    @Volatile
    private var captureInProgress = false

    @Volatile
    private var refineInProgress = false

    private var captureTimeoutRunnable: Runnable? = null
    private var currentAnalysis: FloatingAnalysisResult? = null

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .callTimeout(120, TimeUnit.SECONDS)
        .build()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        if (!Settings.canDrawOverlays(this)) {
            saveCaptureStatus("悬浮窗权限未开启")
            stopSelf()
            return
        }

        loadLastAnalysisFromPreferences()
        ensureOverlayButton()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_CAPTURE_SESSION -> {
                startProjectionForeground()

                val resultCode = intent.getIntExtra(
                    EXTRA_RESULT_CODE,
                    RESULT_CODE_MISSING
                )
                val resultData = getProjectionResultData(intent)

                if (resultCode == RESULT_CODE_MISSING || resultData == null) {
                    handleCaptureFailure("屏幕捕获授权数据缺失，请返回 App 重新授权。")
                    stopSelf()
                    return START_NOT_STICKY
                }

                configureProjection(resultCode, resultData)
            }

            ACTION_SHOW_OVERLAY -> ensureOverlayButton()
            ACTION_SHOW_LAST_RESULT -> showLastStoredResult()
            ACTION_CAPTURE_NOW -> requestSingleCapture()
            ACTION_STOP_SERVICE -> stopSelf()
        }

        // A MediaProjection token cannot safely be recreated after process death.
        return START_NOT_STICKY
    }

    // -------------------------------------------------------------------------
    // Floating bubble
    // -------------------------------------------------------------------------

    private fun ensureOverlayButton() {
        if (floatingButton != null) return
        if (!Settings.canDrawOverlays(this)) return

        floatingButton = TextView(this).apply {
            text = "FG"
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            elevation = dp(8).toFloat()

            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.argb(205, 45, 90, 220))
            }

            setOnTouchListener { _, event ->
                val params = bubbleLayoutParams
                    ?: return@setOnTouchListener false

                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        bubbleInitialX = params.x
                        bubbleInitialY = params.y
                        bubbleInitialTouchX = event.rawX
                        bubbleInitialTouchY = event.rawY
                        bubbleDragging = false
                        bubbleLongPressTriggered = false
                        mainHandler.postDelayed(
                            bubbleLongPressRunnable,
                            LONG_PRESS_MS
                        )
                        true
                    }

                    MotionEvent.ACTION_MOVE -> {
                        val deltaX = event.rawX - bubbleInitialTouchX
                        val deltaY = event.rawY - bubbleInitialTouchY

                        if (abs(deltaX) > DRAG_THRESHOLD ||
                            abs(deltaY) > DRAG_THRESHOLD
                        ) {
                            bubbleDragging = true
                            mainHandler.removeCallbacks(bubbleLongPressRunnable)
                        }

                        params.x = bubbleInitialX + deltaX.toInt()
                        params.y = bubbleInitialY + deltaY.toInt()
                        windowManager?.updateViewLayout(floatingButton, params)
                        true
                    }

                    MotionEvent.ACTION_UP -> {
                        mainHandler.removeCallbacks(bubbleLongPressRunnable)

                        when {
                            bubbleLongPressTriggered -> Unit
                            bubbleDragging -> snapBubbleToScreenEdge()
                            else -> handleBubbleTap()
                        }
                        true
                    }

                    MotionEvent.ACTION_CANCEL -> {
                        mainHandler.removeCallbacks(bubbleLongPressRunnable)
                        true
                    }

                    else -> false
                }
            }
        }

        val preferences = getSharedPreferences(
            FLOATING_POSITION_PREFERENCES,
            MODE_PRIVATE
        )
        val savedX = preferences.getInt("bubble_x", 40)
        val savedY = preferences.getInt("bubble_y", 200)

        bubbleLayoutParams = WindowManager.LayoutParams(
            dp(56),
            dp(56),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = savedX
            y = savedY
        }

        try {
            windowManager?.addView(floatingButton, bubbleLayoutParams)
        } catch (error: Exception) {
            appendDebugLog("添加悬浮按钮失败：${error.message ?: "未知错误"}")
            floatingButton = null
            bubbleLayoutParams = null
            stopSelf()
        }
    }

    private fun handleBubbleTap() {
        val now = SystemClock.uptimeMillis()
        val isDoubleTap = now - lastTapTime <= DOUBLE_TAP_MS

        if (isDoubleTap) {
            pendingSingleTap?.let(mainHandler::removeCallbacks)
            pendingSingleTap = null
            lastTapTime = 0L
            openMainActivity()
            return
        }

        lastTapTime = now
        val runnable = Runnable {
            pendingSingleTap = null
            lastTapTime = 0L
            requestSingleCapture()
        }
        pendingSingleTap = runnable
        mainHandler.postDelayed(runnable, DOUBLE_TAP_MS)
    }

    private fun snapBubbleToScreenEdge() {
        val params = bubbleLayoutParams ?: return
        val button = floatingButton ?: return
        val screenWidth = getScreenWidth()
        val buttonWidth = button.width.takeIf { it > 0 } ?: dp(56)

        params.x = if (params.x + buttonWidth / 2 < screenWidth / 2) {
            dp(8)
        } else {
            screenWidth - buttonWidth - dp(8)
        }

        clampOverlayY(params, button.height.takeIf { it > 0 } ?: dp(56))
        windowManager?.updateViewLayout(button, params)
        saveBubblePosition()
    }

    private fun saveBubblePosition() {
        val params = bubbleLayoutParams ?: return
        getSharedPreferences(FLOATING_POSITION_PREFERENCES, MODE_PRIVATE)
            .edit()
            .putInt("bubble_x", params.x)
            .putInt("bubble_y", params.y)
            .apply()
    }

    // -------------------------------------------------------------------------
    // v0.6 floating result card
    // -------------------------------------------------------------------------

    private fun ensureResultPanel() {
        if (resultPanel != null) return
        if (!Settings.canDrawOverlays(this)) return

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
            elevation = dp(12).toFloat()
            background = roundedBackground(
                fillColor = Color.argb(248, 250, 250, 252),
                radiusDp = 18,
                strokeColor = Color.argb(255, 190, 198, 210),
                strokeWidthDp = 1
            )
        }

        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val headerTitle = TextView(this).apply {
            text = "Floating Guess 结果"
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.rgb(22, 30, 45))
        }
        header.addView(
            headerTitle,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )

        val closeButton = TextView(this).apply {
            text = "×"
            textSize = 24f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(70, 78, 92))
            setPadding(dp(10), 0, dp(4), 0)
            setOnClickListener { hideResultPanel() }
        }
        header.addView(
            closeButton,
            LinearLayout.LayoutParams(dp(42), dp(42))
        )
        root.addView(header)

        resultStatusText = TextView(this).apply {
            text = "等待分析结果"
            textSize = 12f
            setTextColor(Color.rgb(82, 92, 108))
            setPadding(0, 0, 0, dp(6))
        }
        root.addView(resultStatusText)

        topAnswerText = TextView(this).apply {
            text = "—"
            textSize = 28f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.rgb(31, 76, 190))
            setPadding(0, dp(2), 0, dp(3))
        }
        root.addView(topAnswerText)

        topReasonText = TextView(this).apply {
            text = ""
            textSize = 13f
            setTextColor(Color.rgb(65, 74, 89))
            maxLines = 2
            setPadding(0, 0, 0, dp(8))
        }
        root.addView(topReasonText)

        val builtCandidateContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        candidateContainer = builtCandidateContainer
        root.addView(builtCandidateContainer)

        val firstActions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, 0)
        }

        val captureAgainButton = compactButton("再截屏", primary = true) {
            closeRefineEditor(clearInputs = false)
            requestSingleCapture()
        }
        firstActions.addView(
            captureAgainButton,
            LinearLayout.LayoutParams(0, dp(42), 1f).apply {
                marginEnd = dp(5)
            }
        )

        refineToggleButton = compactButton("补充信息", primary = false) {
            if (refineContainer?.visibility == View.VISIBLE) {
                closeRefineEditor(clearInputs = false)
            } else {
                openRefineEditor()
            }
        }
        firstActions.addView(
            refineToggleButton,
            LinearLayout.LayoutParams(0, dp(42), 1f).apply {
                marginStart = dp(5)
            }
        )
        root.addView(firstActions)

        val secondActions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, dp(7), 0, 0)
        }

        secondActions.addView(
            compactButton("复制首选", primary = false) {
                val word = currentAnalysis?.candidates?.firstOrNull()?.word.orEmpty()
                if (word.isBlank()) {
                    Toast.makeText(this, "暂无可复制的答案。", Toast.LENGTH_SHORT).show()
                } else {
                    copyText(word)
                    Toast.makeText(this, "已复制：$word", Toast.LENGTH_SHORT).show()
                }
            },
            LinearLayout.LayoutParams(0, dp(42), 1f).apply {
                marginEnd = dp(5)
            }
        )

        secondActions.addView(
            compactButton("打开 App", primary = false) { openMainActivity() },
            LinearLayout.LayoutParams(0, dp(42), 1f).apply {
                marginStart = dp(5)
            }
        )
        root.addView(secondActions)

        // v0.7 quick refinement editor.
        val builtRefineContainer = buildRefineContainer().apply {
            visibility = View.GONE
        }
        refineContainer = builtRefineContainer
        root.addView(builtRefineContainer)

        header.setOnTouchListener { _, event ->
            val params = resultPanelLayoutParams
                ?: return@setOnTouchListener false

            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    panelInitialX = params.x
                    panelInitialY = params.y
                    panelInitialTouchX = event.rawX
                    panelInitialTouchY = event.rawY
                    panelDragging = false
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - panelInitialTouchX
                    val dy = event.rawY - panelInitialTouchY
                    if (abs(dx) > DRAG_THRESHOLD || abs(dy) > DRAG_THRESHOLD) {
                        panelDragging = true
                    }
                    params.x = panelInitialX + dx.toInt()
                    params.y = panelInitialY + dy.toInt()
                    clampResultPanelPosition(params)
                    resultPanel?.let { panel ->
                        windowManager?.updateViewLayout(panel, params)
                    }
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (panelDragging) saveResultPanelPosition()
                    true
                }

                else -> false
            }
        }

        resultPanel = root

        val screenWidth = getScreenWidth()
        val panelWidth = min(screenWidth - dp(24), dp(360))
        val positionPreferences = getSharedPreferences(
            FLOATING_POSITION_PREFERENCES,
            MODE_PRIVATE
        )

        resultPanelLayoutParams = WindowManager.LayoutParams(
            panelWidth,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            resultPanelFlags(focusable = false),
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = positionPreferences.getInt("result_x", dp(12))
            y = positionPreferences.getInt("result_y", dp(110))
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }

        try {
            windowManager?.addView(root, resultPanelLayoutParams)
            root.visibility = View.GONE
        } catch (error: Exception) {
            appendDebugLog("添加悬浮结果卡片失败：${error.message ?: "未知错误"}")
            resultPanel = null
            resultPanelLayoutParams = null
        }
    }

    private fun renderResultPanel(
        analysis: FloatingAnalysisResult,
        status: String
    ) {
        currentAnalysis = analysis
        mainHandler.post {
            ensureResultPanel()
            val panel = resultPanel ?: return@post

            resultStatusText?.text = status
            val top = analysis.candidates.firstOrNull()
            topAnswerText?.text = top?.let {
                "${it.word}  ${it.confidence}%"
            } ?: "暂无结构化候选"
            topReasonText?.text = top?.reason.orEmpty().ifBlank {
                "点击“打开 App”查看完整 AI 原文。"
            }

            candidateContainer?.removeAllViews()
            analysis.candidates.take(3).forEachIndexed { index, candidate ->
                candidateContainer?.addView(
                    createCandidateRow(index, candidate)
                )
            }

            if (analysis.candidates.isEmpty()) {
                candidateContainer?.addView(
                    TextView(this).apply {
                        text = "后端没有返回 candidates 数组，请打开 App 查看原文。"
                        textSize = 12f
                        setTextColor(Color.rgb(95, 70, 45))
                        setPadding(dp(8), dp(8), dp(8), dp(8))
                    }
                )
            }

            closeRefineEditor(clearInputs = false)
            panel.visibility = View.VISIBLE
            floatingButton?.visibility = View.VISIBLE
            showBubbleMessage("FG")
        }
    }

    private fun createCandidateRow(
        index: Int,
        candidate: FloatingCandidate
    ): View {
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(9), dp(7), dp(9), dp(7))
            background = roundedBackground(
                fillColor = if (index == 0) {
                    Color.rgb(231, 238, 255)
                } else {
                    Color.rgb(241, 244, 248)
                },
                radiusDp = 10
            )
            setOnClickListener {
                openRefineEditor(prefillGuess = candidate.word)
            }
        }

        val text = TextView(this).apply {
            this.text = "${index + 1}. ${candidate.word}"
            textSize = 15f
            typeface = if (index == 0) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            setTextColor(Color.rgb(28, 38, 54))
        }
        row.addView(
            text,
            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        )

        val confidence = TextView(this).apply {
            this.text = "${candidate.confidence}%"
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.rgb(31, 76, 190))
        }
        row.addView(confidence)

        return row.apply {
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            params.topMargin = dp(5)
            layoutParams = params
        }
    }

    private fun showLastStoredResult() {
        ensureOverlayButton()
        val analysis = currentAnalysis ?: loadLastAnalysisFromPreferences()
        if (analysis == null) {
            Toast.makeText(this, "还没有悬浮分析结果。", Toast.LENGTH_SHORT).show()
            return
        }
        renderResultPanel(analysis, "最近一次分析结果")
    }

    private fun hideResultPanel() {
        closeRefineEditor(clearInputs = false)
        resultPanel?.visibility = View.GONE
    }

    private fun saveResultPanelPosition() {
        val params = resultPanelLayoutParams ?: return
        getSharedPreferences(FLOATING_POSITION_PREFERENCES, MODE_PRIVATE)
            .edit()
            .putInt("result_x", params.x)
            .putInt("result_y", params.y)
            .apply()
    }

    // -------------------------------------------------------------------------
    // v0.7 quick floating refinement
    // -------------------------------------------------------------------------

    private fun buildRefineContainer(): LinearLayout {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dp(10), 0, 0)
        }

        val divider = View(this).apply {
            setBackgroundColor(Color.rgb(218, 223, 231))
        }
        container.addView(
            divider,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(1)
            ).apply {
                bottomMargin = dp(9)
            }
        )

        val heading = TextView(this).apply {
            text = "快速补充分析"
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.rgb(30, 40, 56))
        }
        container.addView(heading)

        refineClueInput = compactEditText(
            hint = "新线索（可选）",
            inputType = InputType.TYPE_CLASS_TEXT
        )
        container.addView(refineClueInput)

        val guessRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
        }

        refineGuessInput = compactEditText(
            hint = "高分词",
            inputType = InputType.TYPE_CLASS_TEXT
        )
        guessRow.addView(
            refineGuessInput,
            LinearLayout.LayoutParams(0, dp(48), 1.35f).apply {
                marginEnd = dp(4)
            }
        )

        refineScoreInput = compactEditText(
            hint = "相似度%",
            inputType = InputType.TYPE_CLASS_NUMBER or
                    InputType.TYPE_NUMBER_FLAG_DECIMAL
        )
        guessRow.addView(
            refineScoreInput,
            LinearLayout.LayoutParams(0, dp(48), 0.8f).apply {
                marginStart = dp(4)
            }
        )
        container.addView(guessRow)

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(0, dp(7), 0, 0)
        }

        actions.addView(
            compactButton("取消", primary = false) {
                closeRefineEditor(clearInputs = false)
            },
            LinearLayout.LayoutParams(0, dp(42), 1f).apply {
                marginEnd = dp(5)
            }
        )

        refineSubmitButton = compactButton("补充再分析", primary = true) {
            submitFloatingRefinement()
        }
        actions.addView(
            refineSubmitButton,
            LinearLayout.LayoutParams(0, dp(42), 1.3f).apply {
                marginStart = dp(5)
            }
        )
        container.addView(actions)

        val help = TextView(this).apply {
            text = "高分词和相似度必须一起填写；点击候选行可自动填入高分词。"
            textSize = 11f
            setTextColor(Color.rgb(94, 102, 116))
            setPadding(0, dp(6), 0, 0)
        }
        container.addView(help)

        return container
    }

    private fun openRefineEditor(prefillGuess: String? = null) {
        val analysis = currentAnalysis ?: loadLastAnalysisFromPreferences()
        if (analysis == null) {
            Toast.makeText(this, "请先完成一次截图分析。", Toast.LENGTH_SHORT).show()
            return
        }

        ensureResultPanel()
        resultPanel?.visibility = View.VISIBLE
        refineContainer?.visibility = View.VISIBLE
        refineToggleButton?.text = "收起补充"
        topReasonText?.visibility = View.GONE
        candidateContainer?.visibility = View.GONE

        resultPanelLayoutParams?.let { params ->
            if (panelYBeforeRefine == null) {
                panelYBeforeRefine = params.y
            }
            params.y = dp(16)
            resultPanel?.let { panel ->
                windowManager?.updateViewLayout(panel, params)
            }
        }

        if (!prefillGuess.isNullOrBlank()) {
            refineGuessInput?.setText(prefillGuess)
            refineGuessInput?.setSelection(prefillGuess.length)
        }

        updateResultPanelFocusable(true)
        val focusTarget = if (!prefillGuess.isNullOrBlank()) {
            refineScoreInput
        } else {
            refineClueInput
        } ?: return

        focusTarget.postDelayed({
            focusTarget.requestFocus()
            val inputMethodManager = getSystemService(
                Context.INPUT_METHOD_SERVICE
            ) as InputMethodManager
            inputMethodManager.showSoftInput(
                focusTarget,
                InputMethodManager.SHOW_IMPLICIT
            )
        }, 120L)
    }

    private fun closeRefineEditor(clearInputs: Boolean) {
        if (clearInputs) {
            refineClueInput?.setText("")
            refineGuessInput?.setText("")
            refineScoreInput?.setText("")
        }

        refineClueInput?.clearFocus()
        refineGuessInput?.clearFocus()
        refineScoreInput?.clearFocus()
        refineContainer?.visibility = View.GONE
        refineToggleButton?.text = "补充信息"
        topReasonText?.visibility = View.VISIBLE
        candidateContainer?.visibility = View.VISIBLE

        val previousY = panelYBeforeRefine
        if (previousY != null) {
            resultPanelLayoutParams?.let { params ->
                params.y = previousY
                resultPanel?.let { panel ->
                    windowManager?.updateViewLayout(panel, params)
                }
            }
            panelYBeforeRefine = null
        }

        val inputMethodManager = getSystemService(
            Context.INPUT_METHOD_SERVICE
        ) as InputMethodManager
        resultPanel?.windowToken?.let { token ->
            inputMethodManager.hideSoftInputFromWindow(token, 0)
        }
        updateResultPanelFocusable(false)
    }

    private fun submitFloatingRefinement() {
        if (refineInProgress) return

        val base = currentAnalysis ?: loadLastAnalysisFromPreferences()
        if (base == null) {
            Toast.makeText(this, "请先完成一次截图分析。", Toast.LENGTH_SHORT).show()
            return
        }

        val newClue = refineClueInput?.text?.toString()?.trim().orEmpty()
        val guessWord = refineGuessInput?.text?.toString()?.trim().orEmpty()
        val scoreText = refineScoreInput?.text?.toString()?.trim().orEmpty()

        if (newClue.isBlank() && guessWord.isBlank() && scoreText.isBlank()) {
            resultStatusText?.text = "请填写新线索，或填写高分词和相似度。"
            return
        }

        if (guessWord.isNotBlank() xor scoreText.isNotBlank()) {
            resultStatusText?.text = "高分词和相似度必须一起填写。"
            return
        }

        val score = if (scoreText.isBlank()) null else scoreText.toDoubleOrNull()
        if (scoreText.isNotBlank() && (score == null || score !in 0.0..100.0)) {
            resultStatusText?.text = "相似度必须是 0 到 100 之间的数字。"
            return
        }

        val appPreferences = getSharedPreferences(APP_PREFERENCES, MODE_PRIVATE)
        val storedClues = appPreferences.getString("clueMemory", "")
            .orEmpty()
            .lineSequence()
            .map(String::trim)
            .filter(String::isNotBlank)
            .toList()
        val storedGuesses = parseStoredGuessText(
            appPreferences.getString("guessMemory", "").orEmpty()
        )

        val mergedClues = mergeClues(
            base.topicClues + storedClues,
            newClue
        )
        val mergedGuesses = mergeGuesses(
            base.guesses + storedGuesses,
            if (guessWord.isNotBlank() && score != null) {
                FloatingGuess(guessWord, score)
            } else {
                null
            }
        )

        val guessesJson = JSONArray().apply {
            mergedGuesses.forEach { guess ->
                put(
                    JSONObject()
                        .put("word", guess.word)
                        .put("score", guess.score)
                )
            }
        }

        val requestJson = JSONObject()
            .put("mode", "semantic")
            .put("clues", mergedClues.joinToString("\n"))
            .put("guesses", guessesJson)
            .put("customWords", JSONArray())

        refineInProgress = true
        refineSubmitButton?.isEnabled = false
        refineSubmitButton?.text = "分析中…"
        resultStatusText?.text = "正在结合补充信息重新分析…"
        showBubbleMessage("AI")
        appendDebugLog("悬浮窗发起补充分析")

        val backendUrl = getBackendUrl()
        val body = requestJson
            .toString()
            .toRequestBody("application/json; charset=utf-8".toMediaType())
        val request = Request.Builder()
            .url("$backendUrl/api/analyze")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, error: IOException) {
                finishRefineFailure(
                    "补充分析请求失败：${error.message ?: "网络错误"}"
                )
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val responseText = it.body?.string().orEmpty()
                    if (!it.isSuccessful) {
                        finishRefineFailure(
                            "补充分析失败：HTTP ${it.code} $responseText"
                        )
                        return
                    }

                    try {
                        val parsed = parseAnalysisResponse(responseText)
                        val mergedResult = parsed.copy(
                            topicClues = mergeClues(
                                parsed.topicClues + mergedClues,
                                ""
                            ),
                            guesses = mergeGuesses(
                                parsed.guesses + mergedGuesses,
                                null
                            )
                        )
                        currentAnalysis = mergedResult
                        persistAnalysisResult(
                            mergedResult,
                            "悬浮补充分析完成"
                        )
                        appendDebugLog(
                            "悬浮补充分析成功，候选答案数量：${mergedResult.candidates.size}"
                        )

                        refineInProgress = false
                        mainHandler.post {
                            refineSubmitButton?.isEnabled = true
                            refineSubmitButton?.text = "补充再分析"
                            closeRefineEditor(clearInputs = true)
                            renderResultPanel(
                                mergedResult,
                                "补充分析完成，可继续补充或重新截屏"
                            )
                            Toast.makeText(
                                this@FloatingButtonService,
                                mergedResult.candidates.firstOrNull()?.word?.let {
                                    "新的最可能答案：$it"
                                } ?: "补充分析完成",
                                Toast.LENGTH_LONG
                            ).show()
                        }
                    } catch (error: Exception) {
                        finishRefineFailure(
                            "解析补充分析结果失败：${error.message ?: "未知错误"}"
                        )
                    }
                }
            }
        })
    }

    private fun finishRefineFailure(message: String) {
        refineInProgress = false
        appendDebugLog(message)
        mainHandler.post {
            refineSubmitButton?.isEnabled = true
            refineSubmitButton?.text = "补充再分析"
            resultStatusText?.text = message
            showBubbleMessage("!")
            resetBubbleTextLater()
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
    }

    private fun updateResultPanelFocusable(focusable: Boolean) {
        val panel = resultPanel ?: return
        val params = resultPanelLayoutParams ?: return
        params.flags = resultPanelFlags(focusable)
        try {
            windowManager?.updateViewLayout(panel, params)
        } catch (_: Exception) {
        }
    }

    private fun resultPanelFlags(focusable: Boolean): Int {
        val common = WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
        return if (focusable) {
            common
        } else {
            common or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
        }
    }

    // -------------------------------------------------------------------------
    // Single-frame MediaProjection capture
    // -------------------------------------------------------------------------

    private fun requestSingleCapture() {
        if (mediaProjection == null || virtualDisplay == null || imageReader == null) {
            showBubbleMessage("!")
            Toast.makeText(
                this,
                "请先在 App 内点击“授权并启动悬浮截屏”。",
                Toast.LENGTH_SHORT
            ).show()
            saveCaptureStatus("屏幕捕获会话：未授权或已失效")
            appendDebugLog("点击 FG 时捕获会话不可用")
            resetBubbleTextLater()
            return
        }

        if (captureRequested || captureInProgress || refineInProgress) {
            Toast.makeText(this, "上一项分析仍在进行，请稍等。", Toast.LENGTH_SHORT).show()
            return
        }

        closeRefineEditor(clearInputs = false)
        resultPanel?.visibility = View.INVISIBLE
        floatingButton?.visibility = View.INVISIBLE
        saveCaptureStatus("屏幕捕获会话：准备读取当前画面")
        appendDebugLog("用户轻点 FG，隐藏悬浮 UI 后准备读取一帧")

        mainHandler.postDelayed({
            captureRequested = true

            val timeout = Runnable {
                if (captureRequested) {
                    captureRequested = false
                    handleCaptureFailure("等待屏幕画面超时，请重新点击 FG。")
                }
            }
            captureTimeoutRunnable = timeout
            mainHandler.postDelayed(timeout, CAPTURE_FRAME_TIMEOUT_MS)
        }, OVERLAY_HIDE_BEFORE_CAPTURE_MS)
    }

    private fun configureProjection(resultCode: Int, resultData: Intent) {
        releaseProjectionResources(stopProjection = true)
        ensureOverlayButton()

        try {
            val projectionManager = getSystemService(
                MEDIA_PROJECTION_SERVICE
            ) as MediaProjectionManager
            val projection = projectionManager.getMediaProjection(
                resultCode,
                resultData
            ) ?: throw IllegalStateException("系统未返回有效的 MediaProjection")

            val callback = object : MediaProjection.Callback() {
                override fun onStop() {
                    if (mediaProjection !== projection) return

                    mediaProjection = null
                    mediaProjectionCallback = null
                    releaseDisplayResources()
                    saveCaptureStatus("屏幕捕获会话：已被系统停止，需要重新授权")
                    appendDebugLog("MediaProjection 会话被系统停止")

                    mainHandler.post {
                        Toast.makeText(
                            this@FloatingButtonService,
                            "屏幕捕获会话已停止，请重新授权。",
                            Toast.LENGTH_SHORT
                        ).show()
                        stopSelf()
                    }
                }
            }

            projection.registerCallback(callback, mainHandler)
            mediaProjection = projection
            mediaProjectionCallback = callback

            val (captureWidth, captureHeight) = getCaptureSize()
            val densityDpi = resources.configuration.densityDpi

            imageThread = HandlerThread("FloatingGuessCapture").apply {
                start()
            }
            imageHandler = Handler(
                imageThread?.looper
                    ?: throw IllegalStateException("无法启动截图线程")
            )

            imageReader = ImageReader.newInstance(
                captureWidth,
                captureHeight,
                PixelFormat.RGBA_8888,
                3
            ).also { reader ->
                reader.setOnImageAvailableListener(
                    { availableReader -> handleImageAvailable(availableReader) },
                    imageHandler
                )
            }

            virtualDisplay = projection.createVirtualDisplay(
                "FloatingGuessManualCapture",
                captureWidth,
                captureHeight,
                densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface,
                null,
                imageHandler
            ) ?: throw IllegalStateException("无法创建屏幕捕获显示")

            saveCaptureStatus("屏幕捕获会话：已就绪，轻点 FG 截屏分析")
            appendDebugLog("MediaProjection 会话已就绪：${captureWidth}x${captureHeight}")
            showBubbleMessage("FG")
            Toast.makeText(
                this,
                "轻点 FG 截屏分析；结果会显示在悬浮卡片中。",
                Toast.LENGTH_LONG
            ).show()
        } catch (error: Exception) {
            handleCaptureFailure(
                "启动屏幕捕获会话失败：${error.message ?: "未知错误"}"
            )
            stopSelf()
        }
    }

    private fun handleImageAvailable(reader: ImageReader) {
        val image = try {
            reader.acquireLatestImage()
        } catch (_: Exception) {
            null
        } ?: return

        try {
            if (!captureRequested || captureInProgress) return

            captureRequested = false
            captureTimeoutRunnable?.let(mainHandler::removeCallbacks)
            captureTimeoutRunnable = null
            captureInProgress = true
            saveCaptureStatus("屏幕捕获会话：正在分析截图")
            mainHandler.post {
                floatingButton?.visibility = View.VISIBLE
                showBubbleMessage("AI")
            }

            val bitmap = imageToBitmap(image)
            analyzeCapturedBitmap(bitmap)
        } catch (error: Exception) {
            captureInProgress = false
            handleCaptureFailure(
                "读取屏幕截图失败：${error.message ?: "未知错误"}"
            )
        } finally {
            image.close()
        }
    }

    private fun imageToBitmap(image: Image): Bitmap {
        val plane = image.planes.firstOrNull()
            ?: throw IllegalStateException("截图图像没有可用像素平面")
        val buffer = plane.buffer
        val pixelStride = plane.pixelStride
        val rowStride = plane.rowStride
        val rowPadding = rowStride - pixelStride * image.width
        val paddedWidth = image.width + rowPadding / pixelStride

        val paddedBitmap = Bitmap.createBitmap(
            paddedWidth,
            image.height,
            Bitmap.Config.ARGB_8888
        )
        paddedBitmap.copyPixelsFromBuffer(buffer)

        if (paddedWidth == image.width) return paddedBitmap

        val croppedBitmap = Bitmap.createBitmap(
            paddedBitmap,
            0,
            0,
            image.width,
            image.height
        )
        paddedBitmap.recycle()
        return croppedBitmap
    }

    private fun analyzeCapturedBitmap(bitmap: Bitmap) {
        val imageDataUrl = try {
            bitmapToDataUrl(bitmap)
        } catch (error: Exception) {
            bitmap.recycle()
            captureInProgress = false
            handleCaptureFailure(
                "压缩截图失败：${error.message ?: "未知错误"}"
            )
            return
        }
        bitmap.recycle()

        val payload = JSONObject()
            .put("imageDataUrl", imageDataUrl)
            .toString()
            .toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url("${getBackendUrl()}/api/analyze-image")
            .post(payload)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, error: IOException) {
                captureInProgress = false
                handleCaptureFailure(
                    "悬浮截图分析请求失败：${error.message ?: "网络错误"}"
                )
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val bodyText = it.body?.string().orEmpty()

                    if (!it.isSuccessful) {
                        captureInProgress = false
                        handleCaptureFailure(
                            "悬浮截图分析失败：HTTP ${it.code} $bodyText"
                        )
                        return
                    }

                    try {
                        val analysis = parseAnalysisResponse(bodyText)
                        currentAnalysis = analysis
                        val topCandidate = analysis.candidates.firstOrNull()?.word.orEmpty()
                        val successMessage = if (topCandidate.isBlank()) {
                            "悬浮截图分析完成"
                        } else {
                            "最可能答案：$topCandidate"
                        }

                        persistAnalysisResult(analysis, successMessage)
                        appendDebugLog(
                            "悬浮截图分析成功，候选答案数量：${analysis.candidates.size}"
                        )
                        captureInProgress = false

                        mainHandler.post {
                            floatingButton?.visibility = View.VISIBLE
                            val bubbleText = topCandidate
                                .take(MAX_BUBBLE_RESULT_CHARS)
                                .ifBlank { "OK" }
                            showBubbleMessage(bubbleText)
                            renderResultPanel(
                                analysis,
                                "截图分析完成，可直接查看 Top 3"
                            )
                            Toast.makeText(
                                this@FloatingButtonService,
                                successMessage,
                                Toast.LENGTH_LONG
                            ).show()
                            resetBubbleTextLater(RESULT_DISPLAY_MS)
                        }
                    } catch (error: Exception) {
                        captureInProgress = false
                        handleCaptureFailure(
                            "解析悬浮截图结果失败：${error.message ?: "未知错误"}"
                        )
                    }
                }
            }
        })
    }

    // -------------------------------------------------------------------------
    // Parsing and persistence
    // -------------------------------------------------------------------------

    private fun parseAnalysisResponse(bodyText: String): FloatingAnalysisResult {
        val root = JSONObject(bodyText)
        val aiText = root.optString("aiText", bodyText)
        val aiJson = root.optJSONObject("aiJson")

        val candidates = mutableListOf<FloatingCandidate>()
        aiJson?.optJSONArray("candidates")?.let { array ->
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val keywords = mutableListOf<String>()
                item.optJSONArray("keywords")?.let { keywordsArray ->
                    for (keywordIndex in 0 until keywordsArray.length()) {
                        keywordsArray.optString(keywordIndex)
                            .trim()
                            .takeIf(String::isNotBlank)
                            ?.let(keywords::add)
                    }
                }
                candidates += FloatingCandidate(
                    word = item.optString("word", "未知候选词").trim(),
                    confidence = item.optInt("confidence", 0),
                    reason = item.optString("reason", "").trim(),
                    keywords = keywords
                )
            }
        }

        val clues = mutableListOf<String>()
        aiJson?.optJSONArray("topicClues")?.let { array ->
            for (index in 0 until array.length()) {
                array.optString(index)
                    .trim()
                    .takeIf(String::isNotBlank)
                    ?.let(clues::add)
            }
        }

        val guesses = mutableListOf<FloatingGuess>()
        aiJson?.optJSONArray("guesses")?.let { array ->
            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue
                val word = item.optString("word", "").trim()
                val score = item.optDouble("score", Double.NaN)
                if (word.isNotBlank() && !score.isNaN()) {
                    guesses += FloatingGuess(word, score)
                }
            }
        }

        return FloatingAnalysisResult(
            rawResponse = bodyText,
            aiText = aiText.ifBlank { bodyText },
            candidates = candidates,
            topicClues = clues.distinct(),
            guesses = mergeGuesses(guesses, null)
        )
    }

    private fun persistAnalysisResult(
        analysis: FloatingAnalysisResult,
        message: String
    ) {
        getSharedPreferences(APP_PREFERENCES, MODE_PRIVATE)
            .edit()
            .putString(PREF_PENDING_CAPTURE_RESPONSE, analysis.rawResponse)
            .putString(PREF_PENDING_CAPTURE_MESSAGE, message)
            .putString(PREF_LAST_FLOATING_RESPONSE, analysis.rawResponse)
            .putString(PREF_LAST_FLOATING_MESSAGE, message)
            .putString(
                PREF_CAPTURE_STATUS,
                "屏幕捕获会话：分析完成，可继续轻点 FG"
            )
            .putString("aiResult", analysis.aiText)
            .putString("candidates", candidatesToJsonString(analysis.candidates))
            .putString("clueMemory", analysis.topicClues.joinToString("\n"))
            .putString("guessMemory", analysis.guesses.joinToString("\n") {
                "${it.word} ${formatScore(it.score)}"
            })
            .apply()
    }

    private fun loadLastAnalysisFromPreferences(): FloatingAnalysisResult? {
        val response = getSharedPreferences(APP_PREFERENCES, MODE_PRIVATE)
            .getString(PREF_LAST_FLOATING_RESPONSE, null)
            ?.takeIf(String::isNotBlank)
            ?: return null

        return try {
            parseAnalysisResponse(response).also { currentAnalysis = it }
        } catch (_: Exception) {
            null
        }
    }

    private fun candidatesToJsonString(
        candidates: List<FloatingCandidate>
    ): String {
        val array = JSONArray()
        candidates.forEach { candidate ->
            val keywords = JSONArray()
            candidate.keywords.forEach(keywords::put)
            array.put(
                JSONObject()
                    .put("word", candidate.word)
                    .put("confidence", candidate.confidence)
                    .put("reason", candidate.reason)
                    .put("keywords", keywords)
            )
        }
        return array.toString()
    }

    private fun mergeClues(
        clues: List<String>,
        extra: String
    ): List<String> {
        val seen = LinkedHashSet<String>()
        clues.asSequence()
            .flatMap { it.lineSequence() }
            .map(String::trim)
            .filter(String::isNotBlank)
            .forEach(seen::add)
        extra.lineSequence()
            .map(String::trim)
            .filter(String::isNotBlank)
            .forEach(seen::add)
        return seen.toList()
    }

    private fun mergeGuesses(
        guesses: List<FloatingGuess>,
        extra: FloatingGuess?
    ): List<FloatingGuess> {
        val byWord = LinkedHashMap<String, FloatingGuess>()
        (guesses + listOfNotNull(extra)).forEach { guess ->
            val normalized = normalizeWord(guess.word)
            if (normalized.isNotBlank()) {
                byWord[normalized] = guess.copy(word = guess.word.trim())
            }
        }
        return byWord.values.toList()
    }

    private fun parseStoredGuessText(text: String): List<FloatingGuess> {
        return text.lineSequence()
            .map(String::trim)
            .filter(String::isNotBlank)
            .mapNotNull { line ->
                val parts = line.split(Regex("\\s+"))
                if (parts.size < 2) return@mapNotNull null
                val score = parts.last().toDoubleOrNull() ?: return@mapNotNull null
                val word = parts.dropLast(1).joinToString("").trim()
                if (word.isBlank()) null else FloatingGuess(word, score)
            }
            .toList()
    }

    private fun normalizeWord(word: String): String {
        return word.trim().replace(Regex("\\s+"), "").lowercase(Locale.ROOT)
    }

    // -------------------------------------------------------------------------
    // Foreground service and MediaProjection resources
    // -------------------------------------------------------------------------

    private fun startProjectionForeground() {
        val notificationManager = getSystemService(
            NOTIFICATION_SERVICE
        ) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Floating Guess screen capture",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "User-triggered single-frame screen capture session."
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val openPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = Intent(this, FloatingButtonService::class.java).apply {
            action = ACTION_STOP_SERVICE
        }
        val stopPendingIntent = PendingIntent.getService(
            this,
            1,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(
            this,
            NOTIFICATION_CHANNEL_ID
        )
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle("Floating Guess 悬浮分析已就绪")
            .setContentText("轻点 FG 才会读取一帧；不会连续截图。")
            .setContentIntent(openPendingIntent)
            .addAction(
                android.R.drawable.ic_menu_close_clear_cancel,
                "停止",
                stopPendingIntent
            )
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
            )
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun getProjectionResultData(intent: Intent): Intent? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(EXTRA_RESULT_DATA)
        }
    }

    private fun getCaptureSize(): Pair<Int, Int> {
        val manager = windowManager
            ?: getSystemService(WINDOW_SERVICE) as WindowManager

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = manager.maximumWindowMetrics.bounds
            bounds.width() to bounds.height()
        } else {
            @Suppress("DEPRECATION")
            resources.displayMetrics.widthPixels to resources.displayMetrics.heightPixels
        }
    }

    private fun releaseDisplayResources() {
        captureRequested = false
        captureInProgress = false
        captureTimeoutRunnable?.let(mainHandler::removeCallbacks)
        captureTimeoutRunnable = null

        try {
            imageReader?.setOnImageAvailableListener(null, null)
        } catch (_: Exception) {
        }
        try {
            virtualDisplay?.release()
        } catch (_: Exception) {
        }
        try {
            imageReader?.close()
        } catch (_: Exception) {
        }

        virtualDisplay = null
        imageReader = null

        imageThread?.quitSafely()
        imageThread = null
        imageHandler = null
    }

    private fun releaseProjectionResources(stopProjection: Boolean) {
        releaseDisplayResources()

        val projection = mediaProjection
        val callback = mediaProjectionCallback
        mediaProjection = null
        mediaProjectionCallback = null

        if (projection != null && callback != null) {
            try {
                projection.unregisterCallback(callback)
            } catch (_: Exception) {
            }
        }

        if (stopProjection) {
            try {
                projection?.stop()
            } catch (_: Exception) {
            }
        }
    }

    // -------------------------------------------------------------------------
    // Shared helpers
    // -------------------------------------------------------------------------

    private fun bitmapToDataUrl(
        bitmap: Bitmap,
        maxLongEdge: Int = 900,
        quality: Int = 62
    ): String {
        val longEdge = max(bitmap.width, bitmap.height)
        val scale = if (longEdge > maxLongEdge) {
            maxLongEdge.toFloat() / longEdge.toFloat()
        } else {
            1f
        }

        val resizedBitmap = if (scale < 1f) {
            Bitmap.createScaledBitmap(
                bitmap,
                (bitmap.width * scale).roundToInt(),
                (bitmap.height * scale).roundToInt(),
                true
            )
        } else {
            bitmap
        }

        val output = ByteArrayOutputStream()
        resizedBitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)

        if (resizedBitmap !== bitmap) {
            resizedBitmap.recycle()
        }

        val base64 = android.util.Base64.encodeToString(
            output.toByteArray(),
            android.util.Base64.NO_WRAP
        )
        return "data:image/jpeg;base64,$base64"
    }

    private fun getBackendUrl(): String {
        return getSharedPreferences(APP_PREFERENCES, MODE_PRIVATE)
            .getString("backendUrl", DEFAULT_BACKEND_URL)
            ?.trim()
            ?.removeSuffix("/")
            .orEmpty()
            .ifBlank { DEFAULT_BACKEND_URL }
    }

    private fun openMainActivity() {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(launchIntent)
    }

    private fun copyText(text: String) {
        val clipboard = getSystemService(
            Context.CLIPBOARD_SERVICE
        ) as ClipboardManager
        clipboard.setPrimaryClip(
            ClipData.newPlainText("Floating Guess result", text)
        )
    }

    private fun showBubbleMessage(text: String) {
        mainHandler.post {
            floatingButton?.text = text
        }
    }

    private fun resetBubbleTextLater(delayMs: Long = 1_500L) {
        mainHandler.postDelayed(
            { floatingButton?.text = "FG" },
            delayMs
        )
    }

    private fun handleCaptureFailure(message: String) {
        captureRequested = false
        captureInProgress = false
        captureTimeoutRunnable?.let(mainHandler::removeCallbacks)
        captureTimeoutRunnable = null
        saveCaptureStatus("屏幕捕获会话：操作失败")
        getSharedPreferences(APP_PREFERENCES, MODE_PRIVATE)
            .edit()
            .putString(PREF_PENDING_CAPTURE_MESSAGE, message)
            .apply()
        appendDebugLog(message)

        mainHandler.post {
            floatingButton?.visibility = View.VISIBLE
            showBubbleMessage("!")
            currentAnalysis?.let {
                renderResultPanel(it, message)
            }
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
            resetBubbleTextLater()
        }
    }

    private fun saveCaptureStatus(status: String) {
        getSharedPreferences(APP_PREFERENCES, MODE_PRIVATE)
            .edit()
            .putString(PREF_CAPTURE_STATUS, status)
            .apply()
    }

    private fun appendDebugLog(message: String) {
        val preferences = getSharedPreferences(APP_PREFERENCES, MODE_PRIVATE)
        val current = preferences.getString("debugLog", "").orEmpty()
        val time = SimpleDateFormat(
            "HH:mm:ss",
            Locale.getDefault()
        ).format(Date())
        val line = "[$time] $message"
        val updated = if (current.isBlank()) line else "$line\n$current"
        preferences.edit().putString("debugLog", updated).apply()
    }

    private fun compactButton(
        label: String,
        primary: Boolean,
        onClick: () -> Unit
    ): Button {
        return Button(this).apply {
            text = label
            textSize = 12f
            setAllCaps(false)
            minHeight = 0
            minWidth = 0
            setPadding(dp(6), 0, dp(6), 0)
            setTextColor(if (primary) Color.WHITE else Color.rgb(35, 55, 90))
            background = roundedBackground(
                fillColor = if (primary) {
                    Color.rgb(45, 90, 220)
                } else {
                    Color.rgb(232, 237, 247)
                },
                radiusDp = 10,
                strokeColor = if (primary) null else Color.rgb(178, 188, 207),
                strokeWidthDp = if (primary) 0 else 1
            )
            setOnClickListener { onClick() }
        }
    }

    private fun compactEditText(
        hint: String,
        inputType: Int
    ): EditText {
        return EditText(this).apply {
            this.hint = hint
            this.inputType = inputType
            textSize = 13f
            setTextColor(Color.rgb(28, 38, 54))
            setHintTextColor(Color.rgb(130, 138, 151))
            setSingleLine(true)
            setPadding(dp(10), 0, dp(10), 0)
            background = roundedBackground(
                fillColor = Color.WHITE,
                radiusDp = 9,
                strokeColor = Color.rgb(187, 195, 208),
                strokeWidthDp = 1
            )
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
            ).apply {
                topMargin = dp(6)
            }
        }
    }

    private fun roundedBackground(
        fillColor: Int,
        radiusDp: Int,
        strokeColor: Int? = null,
        strokeWidthDp: Int = 0
    ): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(radiusDp).toFloat()
            setColor(fillColor)
            if (strokeColor != null && strokeWidthDp > 0) {
                setStroke(dp(strokeWidthDp), strokeColor)
            }
        }
    }

    private fun clampResultPanelPosition(
        params: WindowManager.LayoutParams
    ) {
        val panel = resultPanel ?: return
        val width = panel.width.takeIf { it > 0 } ?: params.width
        val height = panel.height.takeIf { it > 0 } ?: dp(380)
        params.x = params.x.coerceIn(0, max(0, getScreenWidth() - width))
        params.y = params.y.coerceIn(0, max(0, getScreenHeight() - height))
    }

    private fun clampOverlayY(
        params: WindowManager.LayoutParams,
        overlayHeight: Int
    ) {
        params.y = params.y.coerceIn(
            0,
            max(0, getScreenHeight() - overlayHeight)
        )
    }

    private fun getScreenWidth(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            (windowManager ?: getSystemService(WINDOW_SERVICE) as WindowManager)
                .maximumWindowMetrics
                .bounds
                .width()
        } else {
            @Suppress("DEPRECATION")
            resources.displayMetrics.widthPixels
        }
    }

    private fun getScreenHeight(): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            (windowManager ?: getSystemService(WINDOW_SERVICE) as WindowManager)
                .maximumWindowMetrics
                .bounds
                .height()
        } else {
            @Suppress("DEPRECATION")
            resources.displayMetrics.heightPixels
        }
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).roundToInt()
    }

    private fun formatScore(score: Double): String {
        return if (score % 1.0 == 0.0) {
            score.toInt().toString()
        } else {
            String.format(Locale.getDefault(), "%.1f", score)
        }
    }

    override fun onDestroy() {
        pendingSingleTap?.let(mainHandler::removeCallbacks)
        pendingSingleTap = null
        mainHandler.removeCallbacks(bubbleLongPressRunnable)
        mainHandler.removeCallbacksAndMessages(null)

        closeRefineEditor(clearInputs = false)
        releaseProjectionResources(stopProjection = true)

        resultPanel?.let { panel ->
            try {
                windowManager?.removeView(panel)
            } catch (_: Exception) {
            }
        }
        floatingButton?.let { button ->
            try {
                windowManager?.removeView(button)
            } catch (_: Exception) {
            }
        }

        resultPanel = null
        resultPanelLayoutParams = null
        floatingButton = null
        bubbleLayoutParams = null
        windowManager = null
        saveCaptureStatus("屏幕捕获会话：已停止")
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private data class FloatingCandidate(
        val word: String,
        val confidence: Int,
        val reason: String,
        val keywords: List<String>
    )

    private data class FloatingGuess(
        val word: String,
        val score: Double
    )

    private data class FloatingAnalysisResult(
        val rawResponse: String,
        val aiText: String,
        val candidates: List<FloatingCandidate>,
        val topicClues: List<String>,
        val guesses: List<FloatingGuess>
    )

    companion object {
        const val ACTION_SHOW_OVERLAY =
            "com.kieran.floatingguess.action.SHOW_OVERLAY"
        const val ACTION_START_CAPTURE_SESSION =
            "com.kieran.floatingguess.action.START_CAPTURE_SESSION"
        const val ACTION_SHOW_LAST_RESULT =
            "com.kieran.floatingguess.action.SHOW_LAST_RESULT"
        const val ACTION_CAPTURE_NOW =
            "com.kieran.floatingguess.action.CAPTURE_NOW"
        const val ACTION_STOP_SERVICE =
            "com.kieran.floatingguess.action.STOP_SERVICE"

        const val EXTRA_RESULT_CODE = "media_projection_result_code"
        const val EXTRA_RESULT_DATA = "media_projection_result_data"

        const val PREF_CAPTURE_STATUS = "screen_capture_status"
        const val PREF_PENDING_CAPTURE_RESPONSE = "pending_capture_response"
        const val PREF_PENDING_CAPTURE_MESSAGE = "pending_capture_message"
        const val PREF_LAST_FLOATING_RESPONSE = "last_floating_response"
        const val PREF_LAST_FLOATING_MESSAGE = "last_floating_message"

        private const val APP_PREFERENCES = "floating_guess_android_state"
        private const val FLOATING_POSITION_PREFERENCES = "floating_button_position"
        private const val DEFAULT_BACKEND_URL =
            "https://floating-guess-backend.onrender.com"

        private const val NOTIFICATION_CHANNEL_ID =
            "floating_guess_media_projection"
        private const val NOTIFICATION_ID = 5001
        private const val RESULT_CODE_MISSING = Int.MIN_VALUE

        private const val DRAG_THRESHOLD = 8f
        private const val LONG_PRESS_MS = 700L
        private const val DOUBLE_TAP_MS = 350L
        private const val OVERLAY_HIDE_BEFORE_CAPTURE_MS = 220L
        private const val CAPTURE_FRAME_TIMEOUT_MS = 4_500L
        private const val RESULT_DISPLAY_MS = 5_000L
        private const val MAX_BUBBLE_RESULT_CHARS = 4
    }
}
package com.kieran.floatingguess

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.res.Resources
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
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
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
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.roundToInt

class FloatingButtonService : Service() {
    private var windowManager: WindowManager? = null
    private var floatingButton: TextView? = null
    private var overlayLayoutParams: WindowManager.LayoutParams? = null

    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false
    private var longPressTriggered = false
    private var lastTapTime = 0L
    private var pendingSingleTap: Runnable? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private val longPressRunnable = Runnable {
        if (!isDragging) {
            longPressTriggered = true
            Toast.makeText(
                this,
                "悬浮按钮已关闭。双击打开 App，拖动移动位置。",
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

    private var captureTimeoutRunnable: Runnable? = null

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
            ACTION_STOP_SERVICE -> stopSelf()
        }

        return START_NOT_STICKY
    }

    private fun ensureOverlayButton() {
        if (floatingButton != null) return
        if (!Settings.canDrawOverlays(this)) return

        floatingButton = TextView(this).apply {
            text = "FG"
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            elevation = 8f

            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.argb(190, 45, 90, 220))
            }

            setOnTouchListener { _, event ->
                val params = overlayLayoutParams
                    ?: return@setOnTouchListener false

                when (event.actionMasked) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isDragging = false
                        longPressTriggered = false
                        mainHandler.postDelayed(longPressRunnable, LONG_PRESS_MS)
                        true
                    }

                    MotionEvent.ACTION_MOVE -> {
                        val deltaX = event.rawX - initialTouchX
                        val deltaY = event.rawY - initialTouchY

                        if (abs(deltaX) > DRAG_THRESHOLD ||
                            abs(deltaY) > DRAG_THRESHOLD
                        ) {
                            isDragging = true
                            mainHandler.removeCallbacks(longPressRunnable)
                        }

                        params.x = initialX + deltaX.toInt()
                        params.y = initialY + deltaY.toInt()
                        windowManager?.updateViewLayout(floatingButton, params)
                        true
                    }

                    MotionEvent.ACTION_UP -> {
                        mainHandler.removeCallbacks(longPressRunnable)

                        when {
                            longPressTriggered -> Unit
                            isDragging -> snapToScreenEdge()
                            else -> handleTap()
                        }

                        true
                    }

                    MotionEvent.ACTION_CANCEL -> {
                        mainHandler.removeCallbacks(longPressRunnable)
                        true
                    }

                    else -> false
                }
            }
        }

        val positionPreferences = getSharedPreferences(
            FLOATING_POSITION_PREFERENCES,
            MODE_PRIVATE
        )
        val savedX = positionPreferences.getInt("x", 40)
        val savedY = positionPreferences.getInt("y", 200)

        overlayLayoutParams = WindowManager.LayoutParams(
            120,
            120,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = savedX
            y = savedY
        }

        try {
            windowManager?.addView(floatingButton, overlayLayoutParams)
        } catch (error: Exception) {
            appendDebugLog("添加悬浮按钮失败：${error.message ?: "未知错误"}")
            floatingButton = null
            overlayLayoutParams = null
            stopSelf()
        }
    }

    private fun handleTap() {
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

        if (captureRequested || captureInProgress) {
            Toast.makeText(this, "正在分析上一张截图，请稍等。", Toast.LENGTH_SHORT).show()
            return
        }

        captureRequested = true
        saveCaptureStatus("屏幕捕获会话：等待当前画面")
        appendDebugLog("用户轻点 FG，准备读取一帧并分析")
        showBubbleMessage("…")

        val timeout = Runnable {
            if (captureRequested) {
                captureRequested = false
                handleCaptureFailure("等待屏幕画面超时，请重新点击 FG。")
            }
        }
        captureTimeoutRunnable = timeout
        mainHandler.postDelayed(timeout, CAPTURE_FRAME_TIMEOUT_MS)
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
                "悬浮截屏已就绪：轻点 FG 截屏分析，双击 FG 打开 App。",
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
            showBubbleMessage("AI")

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

        val appPreferences = getSharedPreferences(
            APP_PREFERENCES,
            MODE_PRIVATE
        )
        val backendUrl = appPreferences.getString(
            "backendUrl",
            DEFAULT_BACKEND_URL
        )
            ?.trim()
            ?.removeSuffix("/")
            .orEmpty()
            .ifBlank { DEFAULT_BACKEND_URL }

        val payload = JSONObject()
            .put("imageDataUrl", imageDataUrl)
            .toString()
            .toRequestBody("application/json; charset=utf-8".toMediaType())

        val request = Request.Builder()
            .url("$backendUrl/api/analyze-image")
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

                    val topCandidate = extractTopCandidate(bodyText)
                    val successMessage = if (topCandidate.isBlank()) {
                        "悬浮截图分析完成，打开 App 查看完整结果。"
                    } else {
                        "最可能答案：$topCandidate"
                    }

                    getSharedPreferences(APP_PREFERENCES, MODE_PRIVATE)
                        .edit()
                        .putString(PREF_PENDING_CAPTURE_RESPONSE, bodyText)
                        .putString(PREF_PENDING_CAPTURE_MESSAGE, successMessage)
                        .putString(
                            PREF_CAPTURE_STATUS,
                            "屏幕捕获会话：分析完成，可继续轻点 FG"
                        )
                        .apply()

                    appendDebugLog(
                        "悬浮截图分析成功${if (topCandidate.isBlank()) "" else "：$topCandidate"}"
                    )
                    captureInProgress = false

                    mainHandler.post {
                        val bubbleText = topCandidate
                            .take(MAX_BUBBLE_RESULT_CHARS)
                            .ifBlank { "OK" }
                        showBubbleMessage(bubbleText)
                        Toast.makeText(
                            this@FloatingButtonService,
                            successMessage,
                            Toast.LENGTH_LONG
                        ).show()
                        resetBubbleTextLater(RESULT_DISPLAY_MS)
                    }
                }
            }
        })
    }

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

    private fun extractTopCandidate(bodyText: String): String {
        return try {
            JSONObject(bodyText)
                .optJSONObject("aiJson")
                ?.optJSONArray("candidates")
                ?.optJSONObject(0)
                ?.optString("word")
                .orEmpty()
                .trim()
        } catch (_: Exception) {
            ""
        }
    }

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
                description = "Keeps the user-authorized manual screen capture session active."
                setShowBadge(false)
            }
            notificationManager.createNotificationChannel(channel)
        }

        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(
            this,
            NOTIFICATION_CHANNEL_ID
        )
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentTitle("Floating Guess 手动截屏已就绪")
            .setContentText("只有轻点 FG 时才读取一帧并发送分析。")
            .setContentIntent(pendingIntent)
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
            startForeground(
                NOTIFICATION_ID,
                notification
            )
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

    private fun openMainActivity() {
        val launchIntent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(launchIntent)
    }

    private fun saveCurrentPosition() {
        val params = overlayLayoutParams ?: return

        getSharedPreferences(FLOATING_POSITION_PREFERENCES, MODE_PRIVATE)
            .edit()
            .putInt("x", params.x)
            .putInt("y", params.y)
            .apply()
    }

    private fun snapToScreenEdge() {
        val params = overlayLayoutParams ?: return
        val button = floatingButton ?: return

        val screenWidth = Resources.getSystem().displayMetrics.widthPixels
        val buttonWidth = button.width.takeIf { it > 0 } ?: 120

        params.x = if (params.x + buttonWidth / 2 < screenWidth / 2) {
            20
        } else {
            screenWidth - buttonWidth - 20
        }

        windowManager?.updateViewLayout(button, params)
        saveCurrentPosition()
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
            showBubbleMessage("!")
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

    override fun onDestroy() {
        pendingSingleTap?.let(mainHandler::removeCallbacks)
        pendingSingleTap = null
        mainHandler.removeCallbacks(longPressRunnable)

        releaseProjectionResources(stopProjection = true)

        floatingButton?.let { button ->
            try {
                windowManager?.removeView(button)
            } catch (_: Exception) {
            }
        }

        floatingButton = null
        overlayLayoutParams = null
        windowManager = null
        saveCaptureStatus("屏幕捕获会话：已停止")
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    companion object {
        const val ACTION_SHOW_OVERLAY =
            "com.kieran.floatingguess.action.SHOW_OVERLAY"
        const val ACTION_START_CAPTURE_SESSION =
            "com.kieran.floatingguess.action.START_CAPTURE_SESSION"
        const val ACTION_STOP_SERVICE =
            "com.kieran.floatingguess.action.STOP_SERVICE"

        const val EXTRA_RESULT_CODE = "media_projection_result_code"
        const val EXTRA_RESULT_DATA = "media_projection_result_data"

        const val PREF_CAPTURE_STATUS = "screen_capture_status"
        const val PREF_PENDING_CAPTURE_RESPONSE = "pending_capture_response"
        const val PREF_PENDING_CAPTURE_MESSAGE = "pending_capture_message"

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
        private const val CAPTURE_FRAME_TIMEOUT_MS = 4_000L
        private const val RESULT_DISPLAY_MS = 5_000L
        private const val MAX_BUBBLE_RESULT_CHARS = 4
    }
}

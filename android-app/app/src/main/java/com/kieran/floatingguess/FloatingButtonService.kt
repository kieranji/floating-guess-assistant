package com.kieran.floatingguess

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.Button
import kotlin.math.abs
import android.widget.Toast

class FloatingButtonService : Service() {
    private var windowManager: WindowManager? = null
    private var floatingButton: Button? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false
    private val preferencesName = "floating_button_position"

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        floatingButton = Button(this).apply {
            text = "FG"
            textSize = 14f
            setOnLongClickListener {
                Toast.makeText(this@FloatingButtonService, "悬浮按钮已关闭", Toast.LENGTH_SHORT).show()
                stopSelf()
                true
            }

            setOnTouchListener { _, event ->
                val params = this@FloatingButtonService.layoutParams ?: return@setOnTouchListener false

                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isDragging = false
                        true
                    }

                    MotionEvent.ACTION_MOVE -> {
                        val deltaX = event.rawX - initialTouchX
                        val deltaY = event.rawY - initialTouchY

                        if (abs(deltaX) > 8 || abs(deltaY) > 8) {
                            isDragging = true
                        }

                        params.x = initialX + deltaX.toInt()
                        params.y = initialY + deltaY.toInt()
                        windowManager?.updateViewLayout(floatingButton, params)
                        true
                    }

                    MotionEvent.ACTION_UP -> {
                        val finalParams = this@FloatingButtonService.layoutParams

                        if (finalParams != null) {
                            getSharedPreferences(preferencesName, MODE_PRIVATE)
                                .edit()
                                .putInt("x", finalParams.x)
                                .putInt("y", finalParams.y)
                                .apply()
                        }

                        if (!isDragging) {
                            val launchIntent = Intent(this@FloatingButtonService, MainActivity::class.java).apply {
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            startActivity(launchIntent)
                        }

                        true
                    }

                    else -> false
                }
            }
        }

        val preferences = getSharedPreferences(preferencesName, MODE_PRIVATE)
        val savedX = preferences.getInt("x", 40)
        val savedY = preferences.getInt("y", 200)

        layoutParams = WindowManager.LayoutParams(
            150,
            150,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = savedX
            y = savedY
        }

        windowManager?.addView(floatingButton, layoutParams)
    }

    override fun onDestroy() {
        super.onDestroy()

        floatingButton?.let { button ->
            windowManager?.removeView(button)
        }

        floatingButton = null
        layoutParams = null
        windowManager = null
    }
}
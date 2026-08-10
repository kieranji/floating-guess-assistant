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

class FloatingButtonService : Service() {
    private var windowManager: WindowManager? = null
    private var floatingButton: Button? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        floatingButton = Button(this).apply {
            text = "FG"
            textSize = 14f

            setOnTouchListener { _, event ->
                val params = layoutParams ?: return@setOnTouchListener false

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

        layoutParams = WindowManager.LayoutParams(
            150,
            150,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 40
            y = 200
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
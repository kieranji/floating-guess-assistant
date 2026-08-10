package com.kieran.floatingguess

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.IBinder
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button

class FloatingButtonService : Service() {
    private var windowManager: WindowManager? = null
    private var floatingButton: Button? = null

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        floatingButton = Button(this).apply {
            text = "FG"
            textSize = 14f

            setOnClickListener {
                val launchIntent = Intent(this@FloatingButtonService, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(launchIntent)
            }
        }

        val layoutParams = WindowManager.LayoutParams(
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
        windowManager = null
    }
}
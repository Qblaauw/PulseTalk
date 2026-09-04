package com.pulsetalq.android.ime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.MotionEvent
import android.view.View
import kotlin.math.roundToInt

class PulseKeyboardView(context: Context) : View(context) {
    interface Listener {
        fun onText(text: String)
        fun onBackspace()
        fun onEnter()
        fun onVoice()
    }

    var listener: Listener? = null

    private val density = resources.displayMetrics.density
    private val keyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(36, 40, 54) }
    private val accentPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(139, 124, 255) }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        textSize = 18f * density
        typeface = android.graphics.Typeface.DEFAULT_BOLD
    }
    private val hintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(190, 194, 208)
        textAlign = Paint.Align.LEFT
        textSize = 13f * density
    }
    private val renderedKeys = mutableListOf<Pair<KeySpec, RectF>>()
    private var shifted = false
    private var symbols = false

    init {
        setBackgroundColor(Color.rgb(17, 19, 26))
        isHapticFeedbackEnabled = true
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val desiredHeight = (322f * density).roundToInt()
        setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), resolveSize(desiredHeight, heightMeasureSpec))
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        renderedKeys.clear()
        drawVoiceBar(canvas)
        drawRows(canvas)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (event.action != MotionEvent.ACTION_UP) return true
        val key = renderedKeys.firstOrNull { (_, bounds) -> bounds.contains(event.x, event.y) }?.first
            ?: return true
        performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP)
        when (key.action) {
            KeyAction.Text, KeyAction.Space -> listener?.onText(key.output)
            KeyAction.Backspace -> listener?.onBackspace()
            KeyAction.Enter -> listener?.onEnter()
            KeyAction.Voice -> listener?.onVoice()
            KeyAction.Shift -> {
                shifted = !shifted
                invalidate()
            }
            KeyAction.Symbols -> {
                symbols = !symbols
                shifted = false
                invalidate()
            }
        }
        return true
    }

    private fun drawVoiceBar(canvas: Canvas) {
        val margin = 8f * density
        val bounds = RectF(margin, margin, width - margin, 54f * density)
        canvas.drawRoundRect(bounds, 18f * density, 18f * density, accentPaint)
        textPaint.textSize = 16f * density
        canvas.drawText("●  Hold to talk", bounds.centerX(), bounds.centerY() + 6f * density, textPaint)
        renderedKeys += KeySpec("Voice", KeyAction.Voice) to bounds
        hintPaint.textAlign = Paint.Align.LEFT
    }

    private fun drawRows(canvas: Canvas) {
        val rows = KeyboardLayout.rows(shifted, symbols)
        val top = 62f * density
        val gap = 5f * density
        val horizontalPadding = 5f * density
        val rowHeight = (height - top - gap * (rows.size + 1)) / rows.size

        rows.forEachIndexed { rowIndex, row ->
            val totalWeight = row.sumOf { it.weight.toDouble() }.toFloat()
            val availableWidth = width - horizontalPadding * 2 - gap * (row.size - 1)
            var left = horizontalPadding
            val keyTop = top + gap + rowIndex * (rowHeight + gap)
            row.forEach { key ->
                val keyWidth = availableWidth * key.weight / totalWeight
                val bounds = RectF(left, keyTop, left + keyWidth, keyTop + rowHeight)
                canvas.drawRoundRect(bounds, 9f * density, 9f * density, keyPaint)
                textPaint.textSize = if (key.label.length > 2) 13f * density else 18f * density
                canvas.drawText(key.label, bounds.centerX(), bounds.centerY() + 6f * density, textPaint)
                renderedKeys += key to bounds
                left += keyWidth + gap
            }
        }
    }
}

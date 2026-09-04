package com.pulsetalq.android.ime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.view.MotionEvent
import android.view.View
import com.pulsetalq.android.dictation.DictationState
import kotlin.math.roundToInt

class PulseKeyboardView(context: Context) : View(context) {
    interface Listener {
        fun onText(text: String)
        fun onBackspace()
        fun onEnter()
        fun onVoice()
        fun onCancelVoice()
        fun onRetryDelivery()
        fun onCopyTranscript()
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
    private var dictationState: DictationState = DictationState.Idle

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
        performClick()
        performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP)
        when (key.action) {
            KeyAction.Text, KeyAction.Space -> listener?.onText(key.output)
            KeyAction.Backspace -> listener?.onBackspace()
            KeyAction.Enter -> listener?.onEnter()
            KeyAction.Voice -> when (key.output) {
                "cancel" -> listener?.onCancelVoice()
                "retry" -> listener?.onRetryDelivery()
                "copy" -> listener?.onCopyTranscript()
                else -> listener?.onVoice()
            }
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

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    fun renderState(state: DictationState) {
        dictationState = state
        invalidate()
    }

    private fun drawVoiceBar(canvas: Canvas) {
        val margin = 8f * density
        val full = RectF(margin, margin, width - margin, 54f * density)
        when (val state = dictationState) {
            is DictationState.Listening -> {
                val split = full.left + full.width() * 0.72f
                drawVoiceButton(canvas, RectF(full.left, full.top, split - 3f * density, full.bottom), "■  Stop", "voice")
                drawVoiceButton(canvas, RectF(split + 3f * density, full.top, full.right, full.bottom), "Cancel", "cancel")
            }
            is DictationState.Transcribing -> drawVoiceButton(canvas, full, "…  Transcribing locally • Cancel", "cancel")
            is DictationState.RecoverableFailure -> if (state.retainedResult != null) {
                val split = full.left + full.width() * 0.68f
                drawVoiceButton(canvas, RectF(full.left, full.top, split - 3f * density, full.bottom), "↻  Retry insertion", "retry")
                drawVoiceButton(canvas, RectF(split + 3f * density, full.top, full.right, full.bottom), "Copy", "copy")
            } else {
                drawVoiceButton(canvas, full, "●  Try dictation again", "voice")
            }
            is DictationState.Completed -> drawVoiceButton(canvas, full, "✓  Inserted • Tap to dictate", "voice")
            is DictationState.Cancelled -> drawVoiceButton(canvas, full, "Cancelled • Tap to dictate", "voice")
            else -> drawVoiceButton(canvas, full, "●  Tap to dictate", "voice")
        }
        hintPaint.textAlign = Paint.Align.LEFT
    }

    private fun drawVoiceButton(canvas: Canvas, bounds: RectF, label: String, output: String) {
        canvas.drawRoundRect(bounds, 18f * density, 18f * density, accentPaint)
        textPaint.textSize = if (label.length > 22) 13f * density else 16f * density
        canvas.drawText(label, bounds.centerX(), bounds.centerY() + 6f * density, textPaint)
        renderedKeys += KeySpec(label, KeyAction.Voice, output = output) to bounds
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

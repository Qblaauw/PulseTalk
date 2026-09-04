package com.pulsetalq.android.ime

import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo

class PulseTalqImeService : InputMethodService(), PulseKeyboardView.Listener {
    private lateinit var keyboardView: PulseKeyboardView
    private val editorGateway = EditorGateway {
        currentInputConnection?.let(::InputConnectionEditorTarget)
    }

    override fun onCreateInputView(): View {
        keyboardView = PulseKeyboardView(this).also { it.listener = this }
        return keyboardView
    }

    override fun onText(text: String) {
        editorGateway.insert(text)
    }

    override fun onBackspace() {
        editorGateway.backspace()
    }

    override fun onEnter() {
        val action = currentInputEditorInfo?.imeOptions?.and(EditorInfo.IME_MASK_ACTION) ?: 0
        editorGateway.enter(action)
    }

    override fun onVoice() {
        // Voice-process binding is added after the isolated service is available.
    }
}

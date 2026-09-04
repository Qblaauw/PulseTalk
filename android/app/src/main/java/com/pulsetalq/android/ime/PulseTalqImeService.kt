package com.pulsetalq.android.ime

import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.inputmethodservice.InputMethodService
import android.os.IBinder
import android.view.View
import android.view.inputmethod.EditorInfo
import androidx.core.content.ContextCompat
import com.pulsetalq.android.dictation.DictationState
import com.pulsetalq.android.voice.IVoiceRecognitionService
import com.pulsetalq.android.voice.VoiceRecognitionService

class PulseTalqImeService : InputMethodService(), PulseKeyboardView.Listener {
    private lateinit var keyboardView: PulseKeyboardView
    private lateinit var dictationController: ImeDictationController
    private var serviceBound = false
    private var bindingRequested = false
    private var pendingStart = false
    private val editorGateway = EditorGateway {
        currentInputConnection?.let(::InputConnectionEditorTarget)
    }
    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            bindingRequested = true
            serviceBound = true
            val service = IVoiceRecognitionService.Stub.asInterface(binder)
            dictationController.onConnected(AidlVoiceService(service))
            if (pendingStart) {
                pendingStart = false
                dictationController.start()
            }
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            bindingRequested = false
            serviceBound = false
            dictationController.onDisconnected()
        }

        override fun onBindingDied(name: ComponentName?) {
            bindingRequested = false
            serviceBound = false
            dictationController.onDisconnected()
        }
    }

    override fun onCreate() {
        super.onCreate()
        dictationController = ImeDictationController(
            insertText = editorGateway::insert,
            copyText = ::copyTranscript,
            onStateChanged = { if (::keyboardView.isInitialized) keyboardView.renderState(it) },
        )
    }

    override fun onCreateInputView(): View {
        keyboardView = PulseKeyboardView(this).also { it.listener = this }
        keyboardView.renderState(dictationController.state)
        return keyboardView
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        bindVoiceService()
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        dictationController.cancel()
        pendingStart = false
        unbindVoiceService()
        super.onFinishInputView(finishingInput)
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
        when (dictationController.state) {
            is DictationState.Listening -> dictationController.stop()
            is DictationState.Transcribing -> Unit
            else -> startDictation()
        }
    }

    override fun onCancelVoice() {
        dictationController.cancel()
    }

    override fun onRetryDelivery() {
        dictationController.retryDelivery()
    }

    override fun onCopyTranscript() {
        dictationController.copyRetained()
    }

    private fun startDictation() {
        ContextCompat.startForegroundService(this, Intent(this, VoiceRecognitionService::class.java))
        if (serviceBound) {
            dictationController.start()
        } else {
            pendingStart = true
            bindVoiceService()
        }
    }

    private fun bindVoiceService() {
        if (bindingRequested) return
        bindingRequested = bindService(
            Intent(this, VoiceRecognitionService::class.java),
            serviceConnection,
            Context.BIND_AUTO_CREATE,
        )
    }

    private fun unbindVoiceService() {
        if (!bindingRequested) return
        runCatching { unbindService(serviceConnection) }
        bindingRequested = false
        serviceBound = false
    }

    private fun copyTranscript(text: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("PulseTalq transcript", text))
    }

    override fun onDestroy() {
        unbindVoiceService()
        super.onDestroy()
    }
}

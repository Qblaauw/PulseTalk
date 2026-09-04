package com.pulsetalq.android.ime

import com.pulsetalq.android.dictation.DictationEvent
import com.pulsetalq.android.dictation.DictationReducer
import com.pulsetalq.android.dictation.DictationState
import com.pulsetalq.android.dictation.VoiceResult
import com.pulsetalq.android.voice.ITranscriptionCallback
import com.pulsetalq.android.voice.IVoiceRecognitionService
import com.pulsetalq.android.voice.VoiceRecognitionService
import java.util.UUID

interface ExternalVoiceListener {
    fun onListening()
    fun onTranscribing(audioDurationMillis: Long)
    fun onCancelled()
    fun onResult(
        transcript: String,
        audioDurationMillis: Long,
        transcriptionDurationMillis: Long,
        modelLoadDurationMillis: Long,
        peakProcessBytes: Long,
    )
    fun onError(message: String, retainedTranscript: String)
}

interface ExternalVoiceService {
    fun start(requestId: String, listener: ExternalVoiceListener)
    fun stop(requestId: String)
    fun cancel(requestId: String)
}

class AidlVoiceService(private val remote: IVoiceRecognitionService) : ExternalVoiceService {
    override fun start(requestId: String, listener: ExternalVoiceListener) {
        remote.startRecording(requestId, object : ITranscriptionCallback.Stub() {
            override fun onStateChanged(state: Int, elapsedMillis: Long) {
                when (state) {
                    VoiceRecognitionService.STATUS_LISTENING -> listener.onListening()
                    VoiceRecognitionService.STATUS_TRANSCRIBING -> listener.onTranscribing(elapsedMillis)
                    VoiceRecognitionService.STATUS_CANCELLED -> listener.onCancelled()
                }
            }

            override fun onResult(
                transcript: String,
                audioDurationMillis: Long,
                transcriptionDurationMillis: Long,
                modelLoadDurationMillis: Long,
                peakProcessBytes: Long,
            ) = listener.onResult(
                transcript,
                audioDurationMillis,
                transcriptionDurationMillis,
                modelLoadDurationMillis,
                peakProcessBytes,
            )

            override fun onError(message: String, retainedTranscript: String) {
                listener.onError(message, retainedTranscript)
            }
        })
    }

    override fun stop(requestId: String) = remote.stopRecording(requestId)

    override fun cancel(requestId: String) = remote.cancelRecording(requestId)
}

class ImeDictationController(
    private val insertText: (String) -> Boolean,
    private val copyText: (String) -> Unit,
    private val onStateChanged: (DictationState) -> Unit = {},
) {
    var state: DictationState = DictationState.Idle
        private set
    private var voiceService: ExternalVoiceService? = null
    private var currentRequestId: String? = null

    fun onConnected(service: ExternalVoiceService) {
        voiceService = service
        if (state is DictationState.RecoverableFailure &&
            (state as DictationState.RecoverableFailure).retainedResult == null
        ) {
            update(DictationState.Idle)
        }
    }

    fun onDisconnected() {
        voiceService = null
        if (state is DictationState.Listening || state is DictationState.Transcribing) {
            currentRequestId = null
            update(DictationState.RecoverableFailure("The local voice service stopped. Tap to retry."))
        }
    }

    fun start() {
        val service = voiceService ?: run {
            update(DictationState.RecoverableFailure("The local voice service is not connected."))
            return
        }
        val requestId = UUID.randomUUID().toString()
        currentRequestId = requestId
        val startState = DictationReducer.reduce(DictationState.Idle, DictationEvent.Start(nowMillis()))
        update(startState)
        try {
            service.start(requestId, listenerFor(requestId))
        } catch (error: Exception) {
            currentRequestId = null
            update(DictationState.RecoverableFailure(error.message ?: "Unable to start dictation."))
        }
    }

    fun stop() {
        val requestId = currentRequestId ?: return
        runCatching { voiceService?.stop(requestId) }.onFailure {
            update(DictationState.RecoverableFailure(it.message ?: "Unable to stop dictation."))
        }
    }

    fun cancel() {
        val requestId = currentRequestId ?: return
        runCatching { voiceService?.cancel(requestId) }
        currentRequestId = null
        update(DictationReducer.reduce(state, DictationEvent.Cancel))
    }

    fun retryDelivery() {
        update(DictationReducer.reduce(state, DictationEvent.RetryDelivery))
        deliverIfReady()
    }

    fun copyRetained(): Boolean {
        val text = (state as? DictationState.RecoverableFailure)
            ?.retainedResult
            ?.transcript
            ?.takeIf(String::isNotBlank)
            ?: return false
        copyText(text)
        return true
    }

    private fun listenerFor(requestId: String) = object : ExternalVoiceListener {
        override fun onListening() = Unit

        override fun onTranscribing(audioDurationMillis: Long) {
            if (requestId != currentRequestId) return
            update(DictationReducer.reduce(state, DictationEvent.Stop(audioDurationMillis)))
        }

        override fun onCancelled() {
            if (requestId != currentRequestId) return
            currentRequestId = null
            update(DictationReducer.reduce(state, DictationEvent.Cancel))
        }

        override fun onResult(
            transcript: String,
            audioDurationMillis: Long,
            transcriptionDurationMillis: Long,
            modelLoadDurationMillis: Long,
            peakProcessBytes: Long,
        ) {
            if (requestId != currentRequestId) return
            currentRequestId = null
            val result = VoiceResult.Success(
                transcript,
                audioDurationMillis,
                transcriptionDurationMillis,
                modelLoadDurationMillis,
                peakProcessBytes,
            )
            update(DictationReducer.reduce(state, DictationEvent.RecognitionFinished(result)))
            deliverIfReady()
        }

        override fun onError(message: String, retainedTranscript: String) {
            if (requestId != currentRequestId) return
            currentRequestId = null
            update(DictationState.RecoverableFailure(message))
        }
    }

    private fun deliverIfReady() {
        val delivering = state as? DictationState.Delivering ?: return
        val event = if (insertText(delivering.result.transcript)) {
            DictationEvent.DeliverySucceeded
        } else {
            DictationEvent.DeliveryFailed("The target app rejected the transcript. Retry or copy it.")
        }
        update(DictationReducer.reduce(delivering, event))
    }

    private fun update(newState: DictationState) {
        state = newState
        onStateChanged(newState)
    }

    private fun nowMillis(): Long = System.currentTimeMillis()
}

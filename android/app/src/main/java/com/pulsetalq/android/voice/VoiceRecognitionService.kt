package com.pulsetalq.android.voice

import android.Manifest
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Debug
import android.os.IBinder
import androidx.core.content.ContextCompat
import com.pulsetalq.android.asr.RecognizerError
import com.pulsetalq.android.asr.RecognizerOutcome
import com.pulsetalq.android.asr.SherpaVoiceRecognizer
import com.pulsetalq.android.asr.VoiceRecognizer
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

class VoiceRecognitionService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val audioRecorder = AudioRecorder()
    private val recognizer: VoiceRecognizer = SherpaVoiceRecognizer()
    private var currentRequestId: String? = null
    private var callback: ITranscriptionCallback? = null
    @Volatile private var status = STATUS_IDLE
    private var peakProcessBytes = 0L

    private val binder = object : IVoiceRecognitionService.Stub() {
        override fun startRecording(requestId: String, requestedCallback: ITranscriptionCallback) {
            scope.launch { beginRecording(requestId, requestedCallback) }
        }

        override fun stopRecording(requestId: String) {
            scope.launch { finishRecording(requestId) }
        }

        override fun cancelRecording(requestId: String) {
            scope.launch { cancelRecordingInternal(requestId) }
        }

        override fun getStatus(): Int = status
    }

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(VoiceNotification.ID, VoiceNotification.create(this, "Preparing local dictation"))
        return START_NOT_STICKY
    }

    private suspend fun beginRecording(requestId: String, requestedCallback: ITranscriptionCallback) {
        if (status != STATUS_IDLE) {
            safeError(requestedCallback, "Another dictation is already active.")
            return
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            safeError(requestedCallback, "Microphone permission is not granted.")
            return
        }
        try {
            currentRequestId = requestId
            callback = requestedCallback
            peakProcessBytes = processBytes()
            audioRecorder.start(scope)
            status = STATUS_LISTENING
            safeState(STATUS_LISTENING, 0)
        } catch (error: Exception) {
            runCatching { audioRecorder.cancel() }
            resetRequest()
            safeError(requestedCallback, error.message ?: "Unable to start the microphone.")
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private suspend fun finishRecording(requestId: String) {
        if (requestId != currentRequestId || status != STATUS_LISTENING) return
        status = STATUS_TRANSCRIBING
        val captured = try {
            audioRecorder.stop()
        } catch (error: Exception) {
            runCatching { audioRecorder.cancel() }
            failCurrent(error.message ?: "Unable to stop the microphone.")
            return
        }
        safeState(STATUS_TRANSCRIBING, captured.durationMillis)
        peakProcessBytes = maxOf(peakProcessBytes, processBytes())

        val modelDirectory = File(filesDir, "models/parakeet-v2-int8")
        val loadDuration = when (val load = recognizer.load(modelDirectory)) {
            is RecognizerOutcome.Success -> load.value
            is RecognizerOutcome.Failure -> {
                failCurrent(load.error.message())
                return
            }
        }
        peakProcessBytes = maxOf(peakProcessBytes, processBytes())
        when (val result = recognizer.transcribe(captured.samples)) {
            is RecognizerOutcome.Success -> {
                peakProcessBytes = maxOf(peakProcessBytes, processBytes())
                val target = callback
                if (result.value.text.isBlank()) {
                    failCurrent("No speech was recognized. Try again closer to the microphone.")
                    return
                }
                runCatching {
                    target?.onResult(
                        result.value.text,
                        captured.durationMillis,
                        result.value.transcriptionDurationMillis,
                        loadDuration,
                        peakProcessBytes,
                    )
                }
                resetRequest()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            is RecognizerOutcome.Failure -> failCurrent(result.error.message())
        }
    }

    private suspend fun cancelRecordingInternal(requestId: String) {
        if (requestId != currentRequestId) return
        audioRecorder.cancel()
        status = STATUS_CANCELLED
        safeState(STATUS_CANCELLED, 0)
        resetRequest()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun failCurrent(message: String) {
        safeError(callback, message)
        resetRequest()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun resetRequest() {
        currentRequestId = null
        callback = null
        status = STATUS_IDLE
    }

    private fun safeState(newStatus: Int, elapsedMillis: Long) {
        runCatching { callback?.onStateChanged(newStatus, elapsedMillis) }
    }

    private fun safeError(target: ITranscriptionCallback?, message: String) {
        runCatching { target?.onError(message, "") }
    }

    private fun processBytes(): Long {
        val memory = Debug.MemoryInfo()
        Debug.getMemoryInfo(memory)
        return memory.totalPss.toLong() * 1024
    }

    override fun onDestroy() {
        runBlocking { runCatching { audioRecorder.cancel() } }
        recognizer.close()
        scope.cancel()
        super.onDestroy()
    }

    private fun RecognizerError.message(): String = when (this) {
        is RecognizerError.ModelMissing -> "Local model file is missing: $path"
        is RecognizerError.LoadFailed -> message
        is RecognizerError.TranscriptionFailed -> message
        RecognizerError.Closed -> "The local recognizer was closed. Reopen the keyboard and retry."
    }

    companion object {
        const val STATUS_IDLE = 0
        const val STATUS_LISTENING = 1
        const val STATUS_TRANSCRIBING = 2
        const val STATUS_CANCELLED = 3
    }
}

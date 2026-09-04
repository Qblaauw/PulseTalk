package com.pulsetalq.android.voice

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import java.util.Collections
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch

data class CapturedAudio(
    val samples: FloatArray,
    val durationMillis: Long,
)

class AudioRecorder(
    private val sampleRate: Int = 16_000,
) {
    private val chunks = Collections.synchronizedList(mutableListOf<ShortArray>())
    private var audioRecord: AudioRecord? = null
    private var captureJob: Job? = null
    @Volatile private var capturing = false
    private var startedAtMillis = 0L

    @Synchronized
    fun start(scope: CoroutineScope) {
        check(!capturing) { "Audio capture is already active." }
        val minimum = AudioRecord.getMinBufferSize(
            sampleRate,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        check(minimum > 0) { "This device does not expose a 16 kHz microphone input." }
        val recorder = AudioRecord.Builder()
            .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                    .build(),
            )
            .setBufferSizeInBytes(minimum * 2)
            .build()
        check(recorder.state == AudioRecord.STATE_INITIALIZED) { "Microphone initialization failed." }

        chunks.clear()
        recorder.startRecording()
        audioRecord = recorder
        capturing = true
        startedAtMillis = android.os.SystemClock.elapsedRealtime()
        captureJob = scope.launch(Dispatchers.IO) {
            val buffer = ShortArray(minimum / 2)
            while (capturing) {
                val count = recorder.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
                if (count > 0) chunks += buffer.copyOf(count)
                if (count < 0 && capturing) throw IllegalStateException("Microphone read failed: $count")
            }
        }
    }

    suspend fun stop(): CapturedAudio {
        val duration = (android.os.SystemClock.elapsedRealtime() - startedAtMillis).coerceAtLeast(0)
        finishCapture(clear = false)
        val snapshot = synchronized(chunks) { chunks.toList() }
        val sampleCount = snapshot.sumOf { it.size }
        val samples = FloatArray(sampleCount)
        var offset = 0
        snapshot.forEach { chunk ->
            chunk.forEach { sample -> samples[offset++] = sample / 32768f }
        }
        chunks.clear()
        return CapturedAudio(samples, duration)
    }

    suspend fun cancel() {
        finishCapture(clear = true)
    }

    private suspend fun finishCapture(clear: Boolean) {
        val recorder = synchronized(this) {
            capturing = false
            audioRecord.also { audioRecord = null }
        }
        runCatching { recorder?.stop() }
        listOfNotNull(captureJob).joinAll()
        captureJob = null
        recorder?.release()
        if (clear) chunks.clear()
    }
}

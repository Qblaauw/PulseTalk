package com.pulsetalq.android.asr

import com.k2fsa.sherpa.onnx.OfflineRecognizer
import java.io.File
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SherpaVoiceRecognizer : VoiceRecognizer {
    private var recognizer: OfflineRecognizer? = null
    private var closed = false

    override val isLoaded: Boolean
        get() = recognizer != null

    override suspend fun load(modelDirectory: File): RecognizerOutcome<Long> = withContext(Dispatchers.Default) {
        if (closed) return@withContext RecognizerOutcome.Failure(RecognizerError.Closed)
        recognizer?.let { return@withContext RecognizerOutcome.Success(0L) }

        val startedAt = System.nanoTime()
        try {
            val config = SherpaConfig.create(modelDirectory)
            recognizer = OfflineRecognizer(assetManager = null, config = config)
            RecognizerOutcome.Success((System.nanoTime() - startedAt) / 1_000_000)
        } catch (error: IllegalArgumentException) {
            RecognizerOutcome.Failure(
                RecognizerError.ModelMissing(error.message ?: modelDirectory.absolutePath),
            )
        } catch (error: Exception) {
            RecognizerOutcome.Failure(
                RecognizerError.LoadFailed(error.message ?: "Unable to load Parakeet."),
            )
        }
    }

    override suspend fun transcribe(
        samples: FloatArray,
        sampleRate: Int,
    ): RecognizerOutcome<Transcript> = withContext(Dispatchers.Default) {
        if (closed) return@withContext RecognizerOutcome.Failure(RecognizerError.Closed)
        val current = recognizer ?: return@withContext RecognizerOutcome.Failure(
            RecognizerError.LoadFailed("The Parakeet model is not loaded."),
        )
        if (sampleRate != 16_000) return@withContext RecognizerOutcome.Failure(
            RecognizerError.TranscriptionFailed("Expected 16000 Hz audio, received $sampleRate Hz."),
        )

        val startedAt = System.nanoTime()
        try {
            val stream = current.createStream()
            try {
                stream.acceptWaveform(samples, sampleRate)
                current.decode(stream)
                RecognizerOutcome.Success(
                    Transcript(
                        text = current.getResult(stream).text.trim(),
                        transcriptionDurationMillis = (System.nanoTime() - startedAt) / 1_000_000,
                    ),
                )
            } finally {
                stream.release()
            }
        } catch (error: Exception) {
            RecognizerOutcome.Failure(
                RecognizerError.TranscriptionFailed(error.message ?: "Transcription failed."),
            )
        }
    }

    override fun close() {
        if (closed) return
        closed = true
        recognizer?.release()
        recognizer = null
    }
}

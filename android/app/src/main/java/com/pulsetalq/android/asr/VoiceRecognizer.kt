package com.pulsetalq.android.asr

import java.io.File

data class Transcript(
    val text: String,
    val transcriptionDurationMillis: Long,
)

sealed interface RecognizerError {
    data class ModelMissing(val path: String) : RecognizerError
    data class LoadFailed(val message: String) : RecognizerError
    data class TranscriptionFailed(val message: String) : RecognizerError
    data object Closed : RecognizerError
}

sealed interface RecognizerOutcome<out T> {
    data class Success<T>(val value: T) : RecognizerOutcome<T>
    data class Failure(val error: RecognizerError) : RecognizerOutcome<Nothing>
}

interface VoiceRecognizer : AutoCloseable {
    val isLoaded: Boolean

    suspend fun load(modelDirectory: File): RecognizerOutcome<Long>

    suspend fun transcribe(samples: FloatArray, sampleRate: Int = 16_000): RecognizerOutcome<Transcript>
}

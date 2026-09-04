package com.pulsetalq.android.dictation

sealed interface VoiceResult {
    data class Success(
        val transcript: String,
        val audioDurationMillis: Long,
        val transcriptionDurationMillis: Long,
        val modelLoadDurationMillis: Long,
        val peakProcessBytes: Long,
    ) : VoiceResult

    data class Failure(
        val message: String,
    ) : VoiceResult
}

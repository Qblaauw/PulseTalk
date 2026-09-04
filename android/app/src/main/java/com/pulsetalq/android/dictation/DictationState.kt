package com.pulsetalq.android.dictation

sealed interface DictationState {
    data object Idle : DictationState
    data class Listening(val startedAtMillis: Long) : DictationState
    data class Transcribing(val audioDurationMillis: Long) : DictationState
    data class Delivering(val result: VoiceResult.Success) : DictationState
    data class RecoverableFailure(
        val message: String,
        val retainedResult: VoiceResult.Success? = null,
    ) : DictationState
    data class Completed(val transcript: String) : DictationState
    data object Cancelled : DictationState
}

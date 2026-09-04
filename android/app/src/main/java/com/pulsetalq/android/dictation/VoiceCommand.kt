package com.pulsetalq.android.dictation

sealed interface VoiceCommand {
    data class Start(val requestId: String) : VoiceCommand
    data class Stop(val requestId: String) : VoiceCommand
    data class Cancel(val requestId: String) : VoiceCommand
}

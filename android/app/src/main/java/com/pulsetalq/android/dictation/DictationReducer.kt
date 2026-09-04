package com.pulsetalq.android.dictation

sealed interface DictationEvent {
    data class Start(val startedAtMillis: Long) : DictationEvent
    data class Stop(val audioDurationMillis: Long) : DictationEvent
    data object Cancel : DictationEvent
    data class RecognitionFinished(val result: VoiceResult) : DictationEvent
    data object DeliverySucceeded : DictationEvent
    data class DeliveryFailed(val message: String) : DictationEvent
    data object RetryDelivery : DictationEvent
    data object Reset : DictationEvent
}

object DictationReducer {
    fun reduce(state: DictationState, event: DictationEvent): DictationState = when {
        event is DictationEvent.Reset -> DictationState.Idle
        event is DictationEvent.Cancel &&
            (state is DictationState.Listening || state is DictationState.Transcribing) -> {
            DictationState.Cancelled
        }
        state is DictationState.Idle && event is DictationEvent.Start -> {
            DictationState.Listening(event.startedAtMillis)
        }
        state is DictationState.Listening && event is DictationEvent.Stop -> {
            DictationState.Transcribing(event.audioDurationMillis)
        }
        state is DictationState.Transcribing && event is DictationEvent.RecognitionFinished -> {
            when (val result = event.result) {
                is VoiceResult.Success -> DictationState.Delivering(result)
                is VoiceResult.Failure -> DictationState.RecoverableFailure(result.message)
            }
        }
        state is DictationState.Delivering && event is DictationEvent.DeliverySucceeded -> {
            DictationState.Completed(state.result.transcript)
        }
        state is DictationState.Delivering && event is DictationEvent.DeliveryFailed -> {
            DictationState.RecoverableFailure(event.message, state.result)
        }
        state is DictationState.RecoverableFailure &&
            event is DictationEvent.RetryDelivery &&
            state.retainedResult != null -> DictationState.Delivering(state.retainedResult)
        else -> state
    }
}

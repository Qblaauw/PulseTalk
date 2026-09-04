package com.pulsetalq.android.dictation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test

class DictationReducerTest {
    private val result = VoiceResult.Success(
        transcript = "A locally transcribed sentence.",
        audioDurationMillis = 2_000,
        transcriptionDurationMillis = 750,
        modelLoadDurationMillis = 4_000,
        peakProcessBytes = 900_000_000,
    )

    @Test
    fun `successful recognition waits for editor delivery`() {
        val listening = DictationReducer.reduce(DictationState.Idle, DictationEvent.Start(100))
        val transcribing = DictationReducer.reduce(listening, DictationEvent.Stop(2_000))
        val delivering = DictationReducer.reduce(transcribing, DictationEvent.RecognitionFinished(result))

        assertEquals(DictationState.Listening(100), listening)
        assertEquals(DictationState.Transcribing(2_000), transcribing)
        assertEquals(DictationState.Delivering(result), delivering)
        assertEquals(
            DictationState.Completed(result.transcript),
            DictationReducer.reduce(delivering, DictationEvent.DeliverySucceeded),
        )
    }

    @Test
    fun `delivery failure retains transcript and can retry`() {
        val delivering = DictationState.Delivering(result)
        val failed = DictationReducer.reduce(
            delivering,
            DictationEvent.DeliveryFailed("The target editor is no longer available."),
        )

        assertEquals(
            DictationState.RecoverableFailure(
                message = "The target editor is no longer available.",
                retainedResult = result,
            ),
            failed,
        )
        assertEquals(delivering, DictationReducer.reduce(failed, DictationEvent.RetryDelivery))
    }

    @Test
    fun `cancelled recording cannot consume a late result`() {
        val cancelled = DictationReducer.reduce(
            DictationState.Listening(startedAtMillis = 100),
            DictationEvent.Cancel,
        )

        assertEquals(DictationState.Cancelled, cancelled)
        assertSame(
            cancelled,
            DictationReducer.reduce(cancelled, DictationEvent.RecognitionFinished(result)),
        )
    }

    @Test
    fun `invalid transition preserves recoverable failure`() {
        val failed = DictationState.RecoverableFailure("Delivery failed", result)

        assertSame(failed, DictationReducer.reduce(failed, DictationEvent.Stop(99)))
    }
}

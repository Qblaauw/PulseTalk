package com.pulsetalq.android.ime

import com.pulsetalq.android.dictation.DictationState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ImeDictationControllerTest {
    @Test
    fun `failed editor insertion retains transcript and retry completes`() {
        val voice = FakeVoiceService()
        val editor = RecordingEditor(accept = false)
        val controller = ImeDictationController(editor::insert, {})
        controller.onConnected(voice)

        controller.start()
        controller.stop()
        voice.listener.onResult("keep this text", 2_000, 700, 4_000, 800_000_000)

        val failed = controller.state as DictationState.RecoverableFailure
        assertEquals("keep this text", failed.retainedResult?.transcript)

        editor.accept = true
        controller.retryDelivery()
        assertEquals(DictationState.Completed("keep this text"), controller.state)
        assertEquals(listOf("keep this text", "keep this text"), editor.attempts)
    }

    @Test
    fun `cancel sends no text even if a late result arrives`() {
        val voice = FakeVoiceService()
        val editor = RecordingEditor()
        val controller = ImeDictationController(editor::insert, {})
        controller.onConnected(voice)

        controller.start()
        controller.cancel()
        voice.listener.onResult("late text", 100, 100, 0, 1)

        assertEquals(DictationState.Cancelled, controller.state)
        assertTrue(editor.attempts.isEmpty())
        assertEquals(1, voice.cancelCalls)
    }

    @Test
    fun `binder death becomes a recoverable keyboard state`() {
        val controller = ImeDictationController({ true }, {})
        controller.onConnected(FakeVoiceService())
        controller.start()

        controller.onDisconnected()

        val failed = controller.state as DictationState.RecoverableFailure
        assertTrue(failed.message.contains("stopped"))
    }

    private class RecordingEditor(var accept: Boolean = true) {
        val attempts = mutableListOf<String>()
        fun insert(text: String): Boolean {
            attempts += text
            return accept
        }
    }

    private class FakeVoiceService : ExternalVoiceService {
        lateinit var listener: ExternalVoiceListener
        var cancelCalls = 0

        override fun start(requestId: String, listener: ExternalVoiceListener) {
            this.listener = listener
        }

        override fun stop(requestId: String) {
            listener.onTranscribing(2_000)
        }

        override fun cancel(requestId: String) {
            cancelCalls += 1
        }
    }
}

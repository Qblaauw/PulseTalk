package com.pulsetalq.android.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class EditorGatewayTest {
    @Test
    fun `text and backspace are delegated to current editor`() {
        val target = FakeEditorTarget()
        val gateway = EditorGateway { target }

        assertTrue(gateway.insert("hello"))
        assertTrue(gateway.backspace())

        assertEquals(listOf("hello"), target.committed)
        assertEquals(1, target.deleteCalls)
    }

    @Test
    fun `enter performs configured action or inserts newline`() {
        val target = FakeEditorTarget()
        val gateway = EditorGateway { target }

        assertTrue(gateway.enter(editorAction = 4))
        assertTrue(gateway.enter(editorAction = 0))

        assertEquals(listOf(4), target.actions)
        assertEquals(listOf("\n"), target.committed)
    }

    @Test
    fun `delivery failure is reported without throwing`() {
        val gateway = EditorGateway { null }

        assertFalse(gateway.insert("retained transcript"))
        assertFalse(gateway.backspace())
    }

    private class FakeEditorTarget : EditorTarget {
        val committed = mutableListOf<String>()
        val actions = mutableListOf<Int>()
        var deleteCalls = 0

        override fun commitText(text: String): Boolean {
            committed += text
            return true
        }

        override fun deleteBeforeCursor(): Boolean {
            deleteCalls += 1
            return true
        }

        override fun performEditorAction(action: Int): Boolean {
            actions += action
            return true
        }
    }
}

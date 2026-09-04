package com.pulsetalq.android.ime

import android.view.inputmethod.InputConnection

interface EditorTarget {
    fun commitText(text: String): Boolean
    fun deleteBeforeCursor(): Boolean
    fun performEditorAction(action: Int): Boolean
}

class InputConnectionEditorTarget(
    private val inputConnection: InputConnection,
) : EditorTarget {
    override fun commitText(text: String): Boolean = inputConnection.commitText(text, 1)

    override fun deleteBeforeCursor(): Boolean = inputConnection.deleteSurroundingText(1, 0)

    override fun performEditorAction(action: Int): Boolean = inputConnection.performEditorAction(action)
}

class EditorGateway(
    private val target: () -> EditorTarget?,
) {
    fun insert(text: String): Boolean = safely { commitText(text) }

    fun backspace(): Boolean = safely { deleteBeforeCursor() }

    fun enter(editorAction: Int): Boolean = if (editorAction == 0) {
        insert("\n")
    } else {
        safely { performEditorAction(editorAction) }
    }

    private fun safely(operation: EditorTarget.() -> Boolean): Boolean = try {
        target()?.operation() ?: false
    } catch (_: RuntimeException) {
        false
    }
}

package com.pulsetalq.android.ime

enum class KeyAction {
    Text,
    Shift,
    Symbols,
    Backspace,
    Enter,
    Space,
    Voice,
}

data class KeySpec(
    val label: String,
    val action: KeyAction,
    val output: String = label,
    val weight: Float = 1f,
)

object KeyboardLayout {
    fun rows(shifted: Boolean, symbols: Boolean): List<List<KeySpec>> {
        if (symbols) return symbolRows
        fun letters(value: String) = value.map { character ->
            val output = if (shifted) character.uppercaseChar() else character
            KeySpec(output.toString(), KeyAction.Text)
        }
        return listOf(
            letters("qwertyuiop"),
            letters("asdfghjkl"),
            listOf(KeySpec("⇧", KeyAction.Shift, weight = 1.35f)) +
                letters("zxcvbnm") +
                KeySpec("⌫", KeyAction.Backspace, weight = 1.35f),
            bottomRow,
        )
    }

    private val bottomRow = listOf(
        KeySpec("123", KeyAction.Symbols, weight = 1.35f),
        KeySpec("space", KeyAction.Space, " ", weight = 4.8f),
        KeySpec("↵", KeyAction.Enter, weight = 1.35f),
    )

    private val symbolRows = listOf(
        "1234567890".map { KeySpec(it.toString(), KeyAction.Text) },
        listOf("@", "#", "$", "%", "&", "-", "+", "(", ")").map { KeySpec(it, KeyAction.Text) },
        listOf(KeySpec("ABC", KeyAction.Symbols, weight = 1.35f)) +
            listOf("*", "\"", "'", ":", ";", "!", "?").map { KeySpec(it, KeyAction.Text) } +
            KeySpec("⌫", KeyAction.Backspace, weight = 1.35f),
        bottomRow.map { if (it.action == KeyAction.Symbols) it.copy(label = "ABC") else it },
    )
}

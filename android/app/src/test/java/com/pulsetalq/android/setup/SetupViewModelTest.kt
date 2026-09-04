package com.pulsetalq.android.setup

import com.pulsetalq.android.model.ModelInstallState
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SetupViewModelTest {
    @Test
    fun `initial setup has four incomplete readiness gates`() {
        val state = SetupViewModel().uiState.value

        assertFalse(state.microphoneGranted)
        assertFalse(state.modelReady)
        assertFalse(state.keyboardEnabled)
        assertFalse(state.keyboardSelected)
        assertFalse(state.readyToDictate)
    }

    @Test
    fun `platform refresh does not discard model progress`() {
        val viewModel = SetupViewModel()
        viewModel.onModelState(ModelInstallState.Downloading("encoder.int8.onnx", 25, 100))

        viewModel.onPlatformReadiness(
            microphoneGranted = true,
            keyboardEnabled = true,
            keyboardSelected = false,
        )

        val state = viewModel.uiState.value
        assertEquals(0.25f, state.modelProgress)
        assertEquals("Downloading encoder.int8.onnx", state.modelMessage)
        assertTrue(state.microphoneGranted)
        assertTrue(state.keyboardEnabled)
    }

    @Test
    fun `all gates produce ready state and failures remain recoverable`() {
        val viewModel = SetupViewModel()
        viewModel.onPlatformReadiness(true, true, true)
        viewModel.onModelState(ModelInstallState.Ready(File("model")))

        assertTrue(viewModel.uiState.value.readyToDictate)

        viewModel.onModelState(ModelInstallState.Failed("Checksum failed"))
        assertFalse(viewModel.uiState.value.readyToDictate)
        assertEquals("Checksum failed", viewModel.uiState.value.errorMessage)

        viewModel.dismissError()
        assertEquals(null, viewModel.uiState.value.errorMessage)
    }
}

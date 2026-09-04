package com.pulsetalq.android.setup

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pulsetalq.android.model.ModelInstallState
import com.pulsetalq.android.model.ModelRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class SetupUiState(
    val microphoneGranted: Boolean = false,
    val modelReady: Boolean = false,
    val keyboardEnabled: Boolean = false,
    val keyboardSelected: Boolean = false,
    val modelProgress: Float? = null,
    val modelMessage: String = "Model not installed",
    val errorMessage: String? = null,
) {
    val readyToDictate: Boolean
        get() = microphoneGranted && modelReady && keyboardEnabled && keyboardSelected
}

class SetupViewModel(
    private val modelRepository: ModelRepository? = null,
) : ViewModel() {
    private val mutableUiState = MutableStateFlow(SetupUiState())
    private var installJob: Job? = null
    val uiState: StateFlow<SetupUiState> = mutableUiState.asStateFlow()

    fun onPlatformReadiness(
        microphoneGranted: Boolean,
        keyboardEnabled: Boolean,
        keyboardSelected: Boolean,
    ) {
        mutableUiState.value = mutableUiState.value.copy(
            microphoneGranted = microphoneGranted,
            keyboardEnabled = keyboardEnabled,
            keyboardSelected = keyboardSelected,
        )
    }

    fun onModelState(state: ModelInstallState) {
        mutableUiState.value = when (state) {
            is ModelInstallState.Missing -> mutableUiState.value.copy(
                modelReady = false,
                modelProgress = null,
                modelMessage = "Download local model",
                errorMessage = null,
            )
            is ModelInstallState.Downloading -> mutableUiState.value.copy(
                modelReady = false,
                modelProgress = if (state.totalBytes == 0L) 0f else {
                    (state.downloadedBytes.toDouble() / state.totalBytes).toFloat().coerceIn(0f, 1f)
                },
                modelMessage = "Downloading ${state.fileName}",
                errorMessage = null,
            )
            is ModelInstallState.Ready -> mutableUiState.value.copy(
                modelReady = true,
                modelProgress = 1f,
                modelMessage = "Local model verified",
                errorMessage = null,
            )
            is ModelInstallState.Failed -> mutableUiState.value.copy(
                modelReady = false,
                modelProgress = null,
                modelMessage = "Model setup needs attention",
                errorMessage = state.message,
            )
        }
    }

    fun refreshModel() {
        val repository = modelRepository ?: return
        viewModelScope.launch {
            onModelState(withContext(Dispatchers.IO) { repository.inspect() })
        }
    }

    fun installModel() {
        val repository = modelRepository ?: return
        if (installJob?.isActive == true) return
        installJob = viewModelScope.launch {
            onModelState(repository.install(::onModelState))
        }
    }

    fun dismissError() {
        mutableUiState.value = mutableUiState.value.copy(errorMessage = null)
    }
}

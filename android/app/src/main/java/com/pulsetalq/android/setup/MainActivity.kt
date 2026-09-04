package com.pulsetalq.android.setup

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue

class MainActivity : ComponentActivity() {
    private val setupViewModel by viewModels<SetupViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val state by setupViewModel.uiState.collectAsState()
            PulseTalqTheme {
                SetupScreen(
                    state = state,
                    onRequestMicrophone = {},
                    onInstallModel = {},
                    onEnableKeyboard = {},
                    onSelectKeyboard = {},
                    onDismissError = setupViewModel::dismissError,
                )
            }
        }
    }
}

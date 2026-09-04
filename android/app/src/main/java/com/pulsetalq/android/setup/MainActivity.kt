package com.pulsetalq.android.setup

import android.Manifest
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.provider.Settings
import android.view.inputmethod.InputMethodManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import com.pulsetalq.android.model.ModelRepository
import com.pulsetalq.android.R
import java.io.File

class MainActivity : ComponentActivity() {
    private val setupViewModel by viewModels<SetupViewModel> {
        object : ViewModelProvider.Factory {
            @Suppress("UNCHECKED_CAST")
            override fun <T : ViewModel> create(modelClass: Class<T>): T = SetupViewModel(
                ModelRepository(File(filesDir, "models/parakeet-v2-int8")),
            ) as T
        }
    }
    private val microphonePermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { refreshReadiness() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val state by setupViewModel.uiState.collectAsState()
            PulseTalqTheme {
                SetupScreen(
                    state = state,
                    onRequestMicrophone = { microphonePermission.launch(Manifest.permission.RECORD_AUDIO) },
                    onInstallModel = setupViewModel::installModel,
                    onEnableKeyboard = {
                        startActivity(Intent(Settings.ACTION_INPUT_METHOD_SETTINGS))
                    },
                    onSelectKeyboard = {
                        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager)
                            .showInputMethodPicker()
                    },
                    onShowNotices = ::showThirdPartyNotices,
                    onDismissError = setupViewModel::dismissError,
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        refreshReadiness()
        setupViewModel.refreshModel()
    }

    private fun refreshReadiness() {
        val inputMethods = getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager
        val enabled = inputMethods.enabledInputMethodList.any {
            it.serviceInfo.packageName == packageName
        }
        val selectedId = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.DEFAULT_INPUT_METHOD,
        ).orEmpty()
        setupViewModel.onPlatformReadiness(
            microphoneGranted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECORD_AUDIO,
            ) == PackageManager.PERMISSION_GRANTED,
            keyboardEnabled = enabled,
            keyboardSelected = selectedId.startsWith("$packageName/"),
        )
    }

    private fun showThirdPartyNotices() {
        val notices = resources.openRawResource(R.raw.third_party_notices)
            .bufferedReader()
            .use { it.readText() }
        AlertDialog.Builder(this)
            .setTitle("Third-party notices")
            .setMessage(notices)
            .setPositiveButton("Close", null)
            .show()
    }
}

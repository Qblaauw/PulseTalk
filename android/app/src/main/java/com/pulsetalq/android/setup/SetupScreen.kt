package com.pulsetalq.android.setup

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Ink = Color(0xFF11131A)
private val Panel = Color(0xFF1A1D27)
private val PanelRaised = Color(0xFF232736)
private val Pulse = Color(0xFF8B7CFF)
private val Mint = Color(0xFF54E1B2)
private val Muted = Color(0xFFA7ADBE)

@Composable
fun PulseTalqTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Pulse,
            secondary = Mint,
            background = Ink,
            surface = Panel,
            onPrimary = Color.White,
            onBackground = Color.White,
            onSurface = Color.White,
        ),
        content = content,
    )
}

@Composable
fun SetupScreen(
    state: SetupUiState,
    onRequestMicrophone: () -> Unit,
    onInstallModel: () -> Unit,
    onEnableKeyboard: () -> Unit,
    onSelectKeyboard: () -> Unit,
    onShowNotices: () -> Unit,
    onDismissError: () -> Unit,
) {
    Surface(modifier = Modifier.fillMaxSize(), color = Ink) {
        Column(
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 28.dp),
        ) {
            Text("PULSETALQ", color = Pulse, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
            Spacer(Modifier.height(10.dp))
            Text("Speak. Review. Send.", fontSize = 30.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text(
                "Private voice typing powered entirely on this phone.",
                color = Muted,
                fontSize = 16.sp,
            )
            Spacer(Modifier.height(22.dp))

            Card(
                colors = CardDefaults.cardColors(containerColor = PanelRaised),
                shape = RoundedCornerShape(20.dp),
            ) {
                Row(
                    modifier = Modifier.padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .background(if (state.readyToDictate) Mint else Pulse, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(if (state.readyToDictate) "✓" else "P", color = Ink, fontWeight = FontWeight.Bold)
                    }
                    Column {
                        Text(
                            if (state.readyToDictate) "Ready to dictate" else "Finish four quick steps",
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            if (state.readyToDictate) "Open any app and select PulseTalq."
                            else "Audio stays local after the model download.",
                            color = Muted,
                            fontSize = 13.sp,
                        )
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            Text("SETUP", color = Muted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))

            SetupRow(
                number = "01",
                title = "Microphone access",
                detail = if (state.microphoneGranted) "Permission granted" else "Required only while dictating",
                complete = state.microphoneGranted,
                action = "Allow",
                onAction = onRequestMicrophone,
            )
            SetupRow(
                number = "02",
                title = "Local speech model",
                detail = state.modelMessage,
                complete = state.modelReady,
                action = "Download",
                onAction = onInstallModel,
                progress = state.modelProgress,
            )
            SetupRow(
                number = "03",
                title = "Enable PulseTalq",
                detail = if (state.keyboardEnabled) "Keyboard enabled" else "Android will show a standard keyboard warning",
                complete = state.keyboardEnabled,
                action = "Open settings",
                onAction = onEnableKeyboard,
            )
            SetupRow(
                number = "04",
                title = "Select keyboard",
                detail = if (state.keyboardSelected) "PulseTalq selected" else "Make PulseTalq the current keyboard",
                complete = state.keyboardSelected,
                action = "Choose",
                onAction = onSelectKeyboard,
            )

            state.errorMessage?.let { message ->
                Spacer(Modifier.height(12.dp))
                Card(colors = CardDefaults.cardColors(containerColor = Color(0xFF40252D))) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Setup needs attention", fontWeight = FontWeight.Bold)
                        Text(message, color = Color(0xFFFFC2CC), fontSize = 13.sp)
                        TextButton(onClick = onDismissError) { Text("Dismiss") }
                    }
                }
            }

            Spacer(Modifier.height(18.dp))
            Text(
                "English • Parakeet TDT INT8 • 661 MB download • Galaxy S20-class or better",
                color = Muted,
                fontSize = 12.sp,
            )
            TextButton(onClick = onShowNotices) { Text("Third-party notices") }
        }
    }
}

@Composable
private fun SetupRow(
    number: String,
    title: String,
    detail: String,
    complete: Boolean,
    action: String,
    onAction: () -> Unit,
    progress: Float? = null,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 10.dp),
        colors = CardDefaults.cardColors(containerColor = Panel),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(number, color = if (complete) Mint else Pulse, fontWeight = FontWeight.Bold)
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 14.dp),
                ) {
                    Text(title, fontWeight = FontWeight.SemiBold)
                    Text(detail, color = Muted, fontSize = 12.sp)
                }
                if (complete) {
                    Text("✓", color = Mint, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                } else {
                    Button(
                        onClick = onAction,
                        colors = ButtonDefaults.buttonColors(containerColor = Pulse),
                    ) { Text(action, fontSize = 11.sp) }
                }
            }
            progress?.takeIf { !complete }?.let {
                Spacer(Modifier.height(10.dp))
                LinearProgressIndicator(
                    progress = { it },
                    modifier = Modifier.fillMaxWidth(),
                    color = Pulse,
                    trackColor = PanelRaised,
                )
            }
        }
    }
}

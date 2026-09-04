package com.pulsetalq.android.setup

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performScrollTo
import org.junit.Rule
import org.junit.Test

class SetupFlowTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    @Test
    fun setupListsAllReadinessStepsWithoutDownloadingModel() {
        composeRule.onNodeWithText("Microphone access").assertIsDisplayed()
        composeRule.onNodeWithText("Local speech model").assertIsDisplayed()
        composeRule.onNodeWithText("Enable PulseTalq").assertIsDisplayed()
        composeRule.onNodeWithText("Select keyboard").performScrollTo().assertIsDisplayed()
    }
}

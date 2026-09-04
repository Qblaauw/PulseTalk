package com.pulsetalq.android.model

import java.io.File
import java.security.MessageDigest
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class ModelRepositoryTest {
    @get:Rule
    val temporaryFolder = TemporaryFolder()

    @Test
    fun `install preserves valid files and downloads only missing assets`() = runTest {
        val root = temporaryFolder.newFolder("model")
        val encoder = asset("encoder.onnx", "encoder")
        val tokens = asset("tokens.txt", "tokens")
        File(root, encoder.fileName).writeText("encoder")
        val downloads = mutableListOf<String>()
        val repository = ModelRepository(
            rootDirectory = root,
            assets = listOf(encoder, tokens),
            downloader = ModelDownloader { asset, destination, _ ->
                downloads += asset.fileName
                destination.writeText("tokens")
            },
            availableBytes = { Long.MAX_VALUE },
            safetyMarginBytes = 0,
        )

        val result = repository.install()

        assertTrue(result is ModelInstallState.Ready)
        assertEquals(listOf("tokens.txt"), downloads)
        assertEquals("encoder", File(root, encoder.fileName).readText())
    }

    @Test
    fun `failed checksum never promotes partial download`() = runTest {
        val root = temporaryFolder.newFolder("checksum")
        val asset = asset("encoder.onnx", "expected")
        val repository = ModelRepository(
            rootDirectory = root,
            assets = listOf(asset),
            downloader = ModelDownloader { _, destination, _ -> destination.writeText("corrupt") },
            availableBytes = { Long.MAX_VALUE },
            safetyMarginBytes = 0,
        )

        val result = repository.install()

        assertTrue(result is ModelInstallState.Failed)
        assertFalse(File(root, asset.fileName).exists())
        assertFalse(File(root, ".${asset.fileName}.part").exists())
    }

    @Test
    fun `insufficient space fails before network access`() = runTest {
        val root = temporaryFolder.newFolder("space")
        val asset = asset("encoder.onnx", "large")
        var downloadCalled = false
        val repository = ModelRepository(
            rootDirectory = root,
            assets = listOf(asset.copy(byteSize = 10_000)),
            downloader = ModelDownloader { _, _, _ -> downloadCalled = true },
            availableBytes = { 9_999 },
            safetyMarginBytes = 0,
        )

        val result = repository.install()

        assertTrue(result is ModelInstallState.Failed)
        assertFalse(downloadCalled)
    }

    private fun asset(fileName: String, content: String) = ModelAsset(
        fileName = fileName,
        url = "https://example.invalid/$fileName",
        byteSize = content.toByteArray().size.toLong(),
        sha256 = sha256(content.toByteArray()),
    )

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
}

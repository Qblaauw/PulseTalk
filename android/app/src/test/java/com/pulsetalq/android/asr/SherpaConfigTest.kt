package com.pulsetalq.android.asr

import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class SherpaConfigTest {
    @get:Rule
    val temporaryFolder = TemporaryFolder()

    @Test
    fun `Parakeet config uses verified external files and CPU provider`() {
        val root = temporaryFolder.newFolder("parakeet")
        listOf("encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt")
            .forEach { File(root, it).writeText("test") }

        val config = SherpaConfig.create(root, numThreads = 4)

        assertEquals("nemo_transducer", config.modelConfig.modelType)
        assertEquals("cpu", config.modelConfig.provider)
        assertEquals(4, config.modelConfig.numThreads)
        assertEquals(File(root, "encoder.int8.onnx").absolutePath, config.modelConfig.transducer.encoder)
        assertEquals(File(root, "tokens.txt").absolutePath, config.modelConfig.tokens)
        assertEquals(16_000, config.featConfig.sampleRate)
        assertEquals("greedy_search", config.decodingMethod)
    }

    @Test
    fun `missing model file is rejected before native load`() {
        val root = temporaryFolder.newFolder("missing")

        val error = runCatching { SherpaConfig.create(root) }.exceptionOrNull()

        assertTrue(error is IllegalArgumentException)
        assertTrue(error?.message.orEmpty().contains("encoder.int8.onnx"))
    }
}

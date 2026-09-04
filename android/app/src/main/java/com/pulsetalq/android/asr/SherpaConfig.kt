package com.pulsetalq.android.asr

import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineTransducerModelConfig
import java.io.File

object SherpaConfig {
    private val requiredFiles = listOf(
        "encoder.int8.onnx",
        "decoder.int8.onnx",
        "joiner.int8.onnx",
        "tokens.txt",
    )

    fun create(
        modelDirectory: File,
        numThreads: Int = Runtime.getRuntime().availableProcessors().coerceIn(2, 4),
    ): OfflineRecognizerConfig {
        requiredFiles.forEach { fileName ->
            require(File(modelDirectory, fileName).isFile) { "Missing model file: $fileName" }
        }

        return OfflineRecognizerConfig(
            featConfig = FeatureConfig(sampleRate = 16_000, featureDim = 80, dither = 0f),
            modelConfig = OfflineModelConfig(
                transducer = OfflineTransducerModelConfig(
                    encoder = File(modelDirectory, "encoder.int8.onnx").absolutePath,
                    decoder = File(modelDirectory, "decoder.int8.onnx").absolutePath,
                    joiner = File(modelDirectory, "joiner.int8.onnx").absolutePath,
                ),
                numThreads = numThreads,
                provider = "cpu",
                modelType = "nemo_transducer",
                tokens = File(modelDirectory, "tokens.txt").absolutePath,
            ),
            decodingMethod = "greedy_search",
        )
    }
}

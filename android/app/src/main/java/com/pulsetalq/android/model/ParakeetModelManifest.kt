package com.pulsetalq.android.model

data class ModelAsset(
    val fileName: String,
    val url: String,
    val byteSize: Long,
    val sha256: String,
)

object ParakeetModelManifest {
    const val REPOSITORY_COMMIT = "1ab9323565ddb038682214b292f588070a538ce2"
    private const val BASE_URL =
        "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8/resolve/$REPOSITORY_COMMIT"

    val assets = listOf(
        ModelAsset(
            "encoder.int8.onnx",
            "$BASE_URL/encoder.int8.onnx",
            652_184_296,
            "a32b12d17bbbc309d0686fbbcc2987b5e9b8333a7da83fa6b089f0a2acd651ab",
        ),
        ModelAsset(
            "decoder.int8.onnx",
            "$BASE_URL/decoder.int8.onnx",
            7_257_753,
            "b6bb64963457237b900e496ee9994b59294526439fbcc1fecf705b31a15c6b4e",
        ),
        ModelAsset(
            "joiner.int8.onnx",
            "$BASE_URL/joiner.int8.onnx",
            1_739_080,
            "7946164367946e7f9f29a122407c3252b680dbae9a51343eb2488d057c3c43d2",
        ),
        ModelAsset(
            "tokens.txt",
            "$BASE_URL/tokens.txt",
            9_384,
            "ec182b70dd42113aff6c5372c75cac58c952443eb22322f57bbd7f53977d497d",
        ),
    )

    val totalBytes: Long = assets.sumOf(ModelAsset::byteSize)
}

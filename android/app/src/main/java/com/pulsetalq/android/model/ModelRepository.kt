package com.pulsetalq.android.model

import android.annotation.SuppressLint
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.nio.file.AtomicMoveNotSupportedException
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.security.MessageDigest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

sealed interface ModelInstallState {
    data class Missing(val requiredBytes: Long) : ModelInstallState
    data class Downloading(
        val fileName: String,
        val downloadedBytes: Long,
        val totalBytes: Long,
    ) : ModelInstallState
    data class Ready(val directory: File) : ModelInstallState
    data class Failed(val message: String) : ModelInstallState
}

fun interface ModelDownloader {
    suspend fun download(asset: ModelAsset, destination: File, onBytes: (Long) -> Unit)
}

class HttpModelDownloader : ModelDownloader {
    override suspend fun download(asset: ModelAsset, destination: File, onBytes: (Long) -> Unit) {
        withContext(Dispatchers.IO) {
            val connection = URL(asset.url).openConnection() as HttpURLConnection
            connection.connectTimeout = 30_000
            connection.readTimeout = 60_000
            connection.instanceFollowRedirects = true
            connection.requestMethod = "GET"
            try {
                connection.connect()
                check(connection.responseCode in 200..299) {
                    "Download failed with HTTP ${connection.responseCode} for ${asset.fileName}"
                }
                connection.inputStream.use { input ->
                    destination.outputStream().buffered().use { output ->
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        var downloaded = 0L
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            output.write(buffer, 0, count)
                            downloaded += count
                            onBytes(downloaded)
                        }
                    }
                }
            } finally {
                connection.disconnect()
            }
        }
    }
}

class ModelRepository(
    private val rootDirectory: File,
    private val assets: List<ModelAsset> = ParakeetModelManifest.assets,
    private val downloader: ModelDownloader = HttpModelDownloader(),
    @param:SuppressLint("UsableSpace")
    private val availableBytes: () -> Long = { rootDirectory.usableSpace },
    private val safetyMarginBytes: Long = 64L * 1024 * 1024,
) {
    fun inspect(): ModelInstallState {
        if (!rootDirectory.exists()) return ModelInstallState.Missing(assets.sumOf(ModelAsset::byteSize))
        val missingBytes = assets.filterNot(::isInstalled).sumOf(ModelAsset::byteSize)
        return if (missingBytes == 0L) {
            ModelInstallState.Ready(rootDirectory)
        } else {
            ModelInstallState.Missing(missingBytes)
        }
    }

    suspend fun install(onState: (ModelInstallState) -> Unit = {}): ModelInstallState {
        return withContext(Dispatchers.IO) {
            try {
                check(rootDirectory.exists() || rootDirectory.mkdirs()) {
                    "Cannot create model directory."
                }
                val missing = assets.filterNot(::isInstalled)
                if (missing.isEmpty()) return@withContext ModelInstallState.Ready(rootDirectory)

                val requiredBytes = missing.sumOf(ModelAsset::byteSize) + safetyMarginBytes
                if (availableBytes() < requiredBytes) {
                    return@withContext ModelInstallState.Failed(
                        "Not enough free space. PulseTalq needs $requiredBytes bytes.",
                    )
                }

                var completedBytes = assets.filter(::isInstalled).sumOf(ModelAsset::byteSize)
                for (asset in missing) {
                    val partial = File(rootDirectory, ".${asset.fileName}.part")
                    if (partial.exists()) partial.delete()
                    downloader.download(asset, partial) { fileBytes ->
                        onState(
                            ModelInstallState.Downloading(
                                asset.fileName,
                                completedBytes + fileBytes,
                                assets.sumOf(ModelAsset::byteSize),
                            ),
                        )
                    }
                    if (!isValid(partial, asset)) {
                        partial.delete()
                        return@withContext ModelInstallState.Failed(
                            "Downloaded ${asset.fileName} failed size or SHA-256 verification.",
                        )
                    }
                    promote(partial, File(rootDirectory, asset.fileName))
                    completedBytes += asset.byteSize
                }
                ModelInstallState.Ready(rootDirectory).also(onState)
            } catch (error: Exception) {
                ModelInstallState.Failed(error.message ?: "Model installation failed.").also(onState)
            }
        }
    }

    private fun isInstalled(asset: ModelAsset): Boolean =
        isValid(File(rootDirectory, asset.fileName), asset)

    private fun isValid(file: File, asset: ModelAsset): Boolean =
        file.isFile && file.length() == asset.byteSize && sha256(file) == asset.sha256

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun promote(partial: File, target: File) {
        try {
            Files.move(
                partial.toPath(),
                target.toPath(),
                StandardCopyOption.ATOMIC_MOVE,
                StandardCopyOption.REPLACE_EXISTING,
            )
        } catch (_: AtomicMoveNotSupportedException) {
            Files.move(partial.toPath(), target.toPath(), StandardCopyOption.REPLACE_EXISTING)
        }
    }
}

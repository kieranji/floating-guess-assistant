package com.kieran.floatingguess

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.unit.dp
import com.kieran.floatingguess.ui.theme.FloatingGuessAssistantTheme
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlin.math.max
import kotlin.math.roundToInt

data class AiCandidate(
    val word: String,
    val confidence: Int,
    val reason: String,
    val keywords: List<String>
)

data class AiParsedResult(
    val aiText: String,
    val candidates: List<AiCandidate>
)

class MainActivity : ComponentActivity() {
    private val backendUrl = "https://floating-guess-backend.onrender.com"
    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            FloatingGuessAssistantTheme {
                var selectedUri by remember { mutableStateOf<Uri?>(null) }
                var selectedBitmap by remember { mutableStateOf<Bitmap?>(null) }
                var aiResult by remember { mutableStateOf("暂无 AI 分析结果。") }
                var candidates by remember { mutableStateOf<List<AiCandidate>>(emptyList()) }
                var statusText by remember { mutableStateOf("请选择一张直播截图。") }
                var isAnalyzing by remember { mutableStateOf(false) }

                val imagePicker = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.GetContent()
                ) { uri ->
                    if (uri != null) {
                        selectedUri = uri
                        selectedBitmap = loadBitmapFromUri(uri)
                        aiResult = "暂无 AI 分析结果。"
                        candidates = emptyList()
                        statusText = "图片已选择，可以开始分析。"
                    }
                }

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Spacer(modifier = Modifier.height(16.dp))

                    Text(
                        text = "Floating Guess Assistant",
                        style = MaterialTheme.typography.headlineMedium
                    )

                    Text(
                        text = "原生 Android v0：选择截图，调用线上后端，显示 AI 分析结果。",
                        style = MaterialTheme.typography.bodyMedium
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            modifier = Modifier.weight(1f),
                            onClick = {
                                imagePicker.launch("image/*")
                            }
                        ) {
                            Text("选择截图")
                        }

                        Button(
                            modifier = Modifier.weight(1f),
                            enabled = selectedUri != null && !isAnalyzing,
                            onClick = {
                                val uri = selectedUri
                                if (uri == null) {
                                    statusText = "请先选择图片。"
                                    return@Button
                                }

                                isAnalyzing = true
                                statusText = "正在压缩并上传图片..."
                                aiResult = "分析中，请稍等..."

                                analyzeImage(
                                    uri = uri,
                                    onSuccess = { result ->
                                        runOnUiThread {
                                            aiResult = result.aiText
                                            candidates = result.candidates
                                            statusText = "分析完成。"
                                            isAnalyzing = false
                                        }
                                    },
                                    onError = { error ->
                                        runOnUiThread {
                                            aiResult = "分析失败：$error"
                                            statusText = "分析失败。"
                                            isAnalyzing = false
                                        }
                                    }
                                )
                            }
                        ) {
                            Text(if (isAnalyzing) "分析中..." else "分析截图")
                        }
                    }

                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            selectedUri = null
                            selectedBitmap = null
                            aiResult = "暂无 AI 分析结果。"
                            candidates = emptyList()
                            statusText = "已清空，可以开始下一题。"
                        }
                    ) {
                        Text("清空，准备下一题")
                    }

                    Text(
                        text = statusText,
                        style = MaterialTheme.typography.bodyMedium
                    )

                    selectedBitmap?.let { bitmap ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                        ) {
                            Image(
                                bitmap = bitmap.asImageBitmap(),
                                contentDescription = "Selected screenshot",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(10.dp)
                            )
                        }
                    }

                    if (candidates.isNotEmpty()) {
                        Text(
                            text = "AI 候选答案",
                            style = MaterialTheme.typography.titleMedium
                        )

                        candidates.forEachIndexed { index, candidate ->
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                            ) {
                                Column(
                                    modifier = Modifier.padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = "${index + 1}. ${candidate.word}",
                                        style = MaterialTheme.typography.titleMedium
                                    )

                                    Text(
                                        text = "置信度：${candidate.confidence}%",
                                        style = MaterialTheme.typography.bodyMedium
                                    )

                                    if (candidate.keywords.isNotEmpty()) {
                                        Text(
                                            text = "关键词：${candidate.keywords.joinToString("、")}",
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }

                                    if (candidate.reason.isNotBlank()) {
                                        Text(
                                            text = candidate.reason,
                                            style = MaterialTheme.typography.bodyMedium
                                        )
                                    }
                                }
                            }
                        }
                    }

                    OutlinedTextField(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(320.dp),
                        value = aiResult,
                        onValueChange = { aiResult = it },
                        label = {
                            Text("AI 分析结果")
                        }
                    )
                }
            }
        }
    }

    private fun analyzeImage(
        uri: Uri,
        onSuccess: (AiParsedResult) -> Unit,
        onError: (String) -> Unit
    ) {
        try {
            val imageDataUrl = compressImageToDataUrl(uri)

            val json = JSONObject()
            json.put("imageDataUrl", imageDataUrl)

            val mediaType = "application/json; charset=utf-8".toMediaType()
            val requestBody = json.toString().toRequestBody(mediaType)

            val request = Request.Builder()
                .url("$backendUrl/api/analyze-image")
                .post(requestBody)
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    onError(e.message ?: "网络请求失败")
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        val bodyText = it.body?.string() ?: ""

                        if (!it.isSuccessful) {
                            onError("HTTP ${it.code}: $bodyText")
                            return
                        }

                        try {
                            val parsedResult = parseAnalyzeImageResponse(bodyText)
                            onSuccess(parsedResult)
                        } catch (error: Exception) {
                            onSuccess(
                                AiParsedResult(
                                    aiText = bodyText,
                                    candidates = emptyList()
                                )
                            )
                        }
                    }
                }
            })
        } catch (error: Exception) {
            onError(error.message ?: "未知错误")
        }
    }

    private fun loadBitmapFromUri(uri: Uri): Bitmap? {
        return try {
            contentResolver.openInputStream(uri).use { inputStream ->
                BitmapFactory.decodeStream(inputStream)
            }
        } catch (error: Exception) {
            null
        }
    }

    private fun parseAnalyzeImageResponse(bodyText: String): AiParsedResult {
        val responseJson = JSONObject(bodyText)

        val aiText = responseJson.optString("aiText", bodyText)
        val aiJson = responseJson.optJSONObject("aiJson")

        val candidatesJsonArray = aiJson?.optJSONArray("candidates")
        val candidateList = mutableListOf<AiCandidate>()

        if (candidatesJsonArray != null) {
            for (index in 0 until candidatesJsonArray.length()) {
                val item = candidatesJsonArray.optJSONObject(index) ?: continue

                val keywordsJsonArray = item.optJSONArray("keywords")
                val keywords = mutableListOf<String>()

                if (keywordsJsonArray != null) {
                    for (keywordIndex in 0 until keywordsJsonArray.length()) {
                        val keyword = keywordsJsonArray.optString(keywordIndex)
                        if (keyword.isNotBlank()) {
                            keywords.add(keyword)
                        }
                    }
                }

                candidateList.add(
                    AiCandidate(
                        word = item.optString("word", "未知候选词"),
                        confidence = item.optInt("confidence", 0),
                        reason = item.optString("reason", ""),
                        keywords = keywords
                    )
                )
            }
        }

        return AiParsedResult(
            aiText = aiText.ifBlank { bodyText },
            candidates = candidateList
        )
    }

    private fun compressImageToDataUrl(
        uri: Uri,
        maxLongEdge: Int = 900,
        quality: Int = 62
    ): String {
        val originalBitmap = contentResolver.openInputStream(uri).use { inputStream ->
            BitmapFactory.decodeStream(inputStream)
        } ?: throw IllegalArgumentException("无法读取图片")

        val width = originalBitmap.width
        val height = originalBitmap.height
        val longEdge = max(width, height)
        val scale = if (longEdge > maxLongEdge) {
            maxLongEdge.toFloat() / longEdge.toFloat()
        } else {
            1f
        }

        val targetWidth = (width * scale).roundToInt()
        val targetHeight = (height * scale).roundToInt()

        val resizedBitmap = Bitmap.createScaledBitmap(
            originalBitmap,
            targetWidth,
            targetHeight,
            true
        )

        val outputStream = ByteArrayOutputStream()
        resizedBitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)

        val base64 = Base64.encodeToString(
            outputStream.toByteArray(),
            Base64.NO_WRAP
        )

        return "data:image/jpeg;base64,$base64"
    }
}
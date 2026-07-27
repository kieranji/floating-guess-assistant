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
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlin.math.max
import kotlin.math.roundToInt
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
import android.content.SharedPreferences
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.runtime.Composable
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

data class AiCandidate(
    val word: String,
    val confidence: Int,
    val reason: String,
    val keywords: List<String>
)

data class AiGuess(
    val word: String,
    val score: Double
)

data class AiParsedResult(
    val aiText: String,
    val candidates: List<AiCandidate>,
    val topicClues: List<String>,
    val guesses: List<AiGuess>
)

data class HistoryItem(
    val time: String,
    val title: String,
    val aiText: String,
    val candidates: List<AiCandidate>,
    val clueMemory: String,
    val guessMemory: String
)

@Composable
fun SectionCard(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium
            )

            content()
        }
    }
}

class MainActivity : ComponentActivity() {
    private val backendUrl = "https://floating-guess-backend.onrender.com"
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .callTimeout(120, TimeUnit.SECONDS)
        .build()
    private val preferencesName = "floating_guess_android_state"

    private lateinit var preferences: SharedPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        preferences = getSharedPreferences(preferencesName, Context.MODE_PRIVATE)

        setContent {
            FloatingGuessAssistantTheme {
                var selectedUri by remember { mutableStateOf<Uri?>(null) }
                var selectedBitmap by remember { mutableStateOf<Bitmap?>(null) }


                var aiResult by remember {
                    mutableStateOf(preferences.getString("aiResult", "暂无 AI 分析结果。") ?: "暂无 AI 分析结果。")
                }

                var candidates by remember {
                    mutableStateOf(
                        candidatesFromJsonString(
                            preferences.getString("candidates", "[]") ?: "[]"
                        )
                    )
                }

                var clueMemory by remember {
                    mutableStateOf(preferences.getString("clueMemory", "") ?: "")
                }

                var guessMemory by remember {
                    mutableStateOf(preferences.getString("guessMemory", "") ?: "")
                }

                var supplementClue by remember {
                    mutableStateOf(preferences.getString("supplementClue", "") ?: "")
                }

                var supplementGuessWord by remember {
                    mutableStateOf(preferences.getString("supplementGuessWord", "") ?: "")
                }

                var supplementGuessScore by remember {
                    mutableStateOf(preferences.getString("supplementGuessScore", "") ?: "")
                }

                var statusText by remember {
                    mutableStateOf(preferences.getString("statusText", "请选择一张直播截图。") ?: "请选择一张直播截图。")
                }

                var historyList by remember {
                    mutableStateOf(
                        historyFromJsonString(
                            preferences.getString("historyList", "[]") ?: "[]"
                        )
                    )
                }

                var isAnalyzing by remember { mutableStateOf(false) }
                var isRefining by remember { mutableStateOf(false) }

                LaunchedEffect(
                    aiResult,
                    candidates,
                    clueMemory,
                    guessMemory,
                    supplementClue,
                    supplementGuessWord,
                    supplementGuessScore,
                    statusText,
                    historyList
                ) {
                    preferences.edit()
                        .putString("aiResult", aiResult)
                        .putString("candidates", candidatesToJsonString(candidates))
                        .putString("clueMemory", clueMemory)
                        .putString("guessMemory", guessMemory)
                        .putString("supplementClue", supplementClue)
                        .putString("supplementGuessWord", supplementGuessWord)
                        .putString("supplementGuessScore", supplementGuessScore)
                        .putString("statusText", statusText)
                        .putString("historyList", historyToJsonString(historyList))
                        .apply()
                }

                val imagePicker = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.GetContent()
                ) { uri: Uri? ->
                    if (uri != null) {
                        selectedUri = uri
                        selectedBitmap = loadBitmapFromUri(uri)

                        aiResult = "暂无 AI 分析结果。"
                        candidates = emptyList()
                        clueMemory = ""
                        guessMemory = ""
                        supplementClue = ""
                        supplementGuessWord = ""
                        supplementGuessScore = ""

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

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Floating Guess Assistant",
                                style = MaterialTheme.typography.headlineMedium
                            )

                            Text(
                                text = "Android Native v0.1.0",
                                style = MaterialTheme.typography.titleMedium
                            )

                            Text(
                                text = "选择截图、AI 分析、补充线索再分析。",
                                style = MaterialTheme.typography.bodyMedium
                            )

                            Text(
                                text = "后端：Render 在线服务。第一次请求可能需要等待 30–60 秒。",
                                style = MaterialTheme.typography.bodySmall
                            )

                            OutlinedButton(
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !isAnalyzing && !isRefining,
                                onClick = {
                                    statusText = "正在检查后端状态..."

                                    checkBackendHealth(
                                        onSuccess = { message: String ->
                                            runOnUiThread {
                                                statusText = message
                                            }
                                        },
                                        onError = { error: String ->
                                            runOnUiThread {
                                                statusText = "后端检查失败：$error"
                                            }
                                        }
                                    )
                                }
                            ) {
                                Text("检查后端状态")
                            }
                        }
                    }

                    SectionCard(title = "截图分析") {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                modifier = Modifier.weight(1f),
                                enabled = !isAnalyzing && !isRefining,
                                onClick = {
                                    imagePicker.launch("image/*")
                                }
                            ) {
                                Text("选择截图")
                            }

                            Button(
                                modifier = Modifier.weight(1f),
                                enabled = selectedUri != null && !isAnalyzing && !isRefining,
                                onClick = {
                                    val uri = selectedUri
                                    if (uri == null) {
                                        statusText = "请先选择图片。"
                                        return@Button
                                    }

                                    isAnalyzing = true
                                    statusText = "正在压缩并上传图片..."
                                    aiResult = "分析中，请稍等..."
                                    candidates = emptyList()

                                    analyzeImage(
                                        uri = uri,
                                        onSuccess = { result: AiParsedResult ->
                                            runOnUiThread {
                                                aiResult = result.aiText
                                                candidates = result.candidates
                                                clueMemory = result.topicClues.joinToString("\n")
                                                guessMemory = result.guesses.joinToString("\n") { guess ->
                                                    "${guess.word} ${formatScore(guess.score)}"
                                                }

                                                historyList = addHistoryItem(
                                                    historyList = historyList,
                                                    aiText = result.aiText,
                                                    candidates = result.candidates,
                                                    clueMemory = clueMemory,
                                                    guessMemory = guessMemory
                                                )

                                                statusText = "分析完成。"
                                                isAnalyzing = false
                                            }
                                        },
                                        onError = { error: String ->
                                            runOnUiThread {
                                                aiResult = """
分析失败。

错误信息：
$error

你可以：
1. 等 30 秒后重新点击“分析截图”
2. 检查 Render 后端是否休眠
3. 检查图片是否太大或太模糊
4. 检查后端 API key 是否正常
                            """.trimIndent()

                                                statusText = "分析失败，可以重新点击“分析截图”重试。"
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
                            enabled = !isAnalyzing && !isRefining,
                            onClick = {
                                selectedUri = null
                                selectedBitmap = null
                                aiResult = "暂无 AI 分析结果。"
                                candidates = emptyList()
                                clueMemory = ""
                                guessMemory = ""
                                supplementClue = ""
                                supplementGuessWord = ""
                                supplementGuessScore = ""
                                statusText = "已清空，可以开始下一题。"
                                preferences.edit().clear().apply()
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
                                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
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
                    }

                    if (clueMemory.isNotBlank() || guessMemory.isNotBlank()) {
                        SectionCard(title = "当前题目信息") {

                                if (clueMemory.isNotBlank()) {
                                    Text(
                                        text = "线索：\n$clueMemory",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }

                                if (guessMemory.isNotBlank()) {
                                    Text(
                                        text = "历史猜测：\n$guessMemory",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }

                        }
                    }

                    SectionCard(title = "补充新信息后重新分析") {

                            OutlinedTextField(
                                modifier = Modifier.fillMaxWidth(),
                                value = supplementClue,
                                onValueChange = { supplementClue = it },
                                label = { Text("新线索") },
                                placeholder = { Text("例如：和声音有关 / 是一种休闲活动") }
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                OutlinedTextField(
                                    modifier = Modifier.weight(1f),
                                    value = supplementGuessWord,
                                    onValueChange = { supplementGuessWord = it },
                                    label = { Text("高分词") },
                                    placeholder = { Text("例如：听雨") }
                                )

                                OutlinedTextField(
                                    modifier = Modifier.weight(1f),
                                    value = supplementGuessScore,
                                    onValueChange = { supplementGuessScore = it },
                                    label = { Text("相似度") },
                                    placeholder = { Text("例如：44.9") }
                                )
                            }

                            Button(
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !isAnalyzing && !isRefining,
                                onClick = {
                                    val newClue = supplementClue.trim()
                                    val guessWord = supplementGuessWord.trim()
                                    val guessScoreText = supplementGuessScore.trim()

                                    if (newClue.isBlank() && guessWord.isBlank() && guessScoreText.isBlank()) {
                                        statusText = "请先输入新线索，或输入高分词和相似度。"
                                        return@Button
                                    }

                                    if (guessWord.isNotBlank() || guessScoreText.isNotBlank()) {
                                        if (guessWord.isBlank() || guessScoreText.isBlank()) {
                                            statusText = "高分词和相似度需要一起填写。"
                                            return@Button
                                        }

                                        val score = guessScoreText.toDoubleOrNull()
                                        if (score == null || score < 0.0 || score > 100.0) {
                                            statusText = "相似度必须是 0 到 100 之间的数字。"
                                            return@Button
                                        }

                                        guessMemory = mergeUniqueLines(
                                            guessMemory,
                                            "$guessWord ${formatScore(score)}"
                                        )
                                    }

                                    if (newClue.isNotBlank()) {
                                        clueMemory = mergeUniqueLines(clueMemory, newClue)
                                    }

                                    isRefining = true
                                    statusText = "正在结合补充信息重新分析..."
                                    aiResult = "补充分析中，请稍等..."

                                    analyzeText(
                                        clues = clueMemory,
                                        guessText = guessMemory,
                                        onSuccess = { result: AiParsedResult ->
                                            runOnUiThread {
                                                aiResult = result.aiText
                                                candidates = result.candidates

                                                if (result.topicClues.isNotEmpty()) {
                                                    clueMemory = mergeUniqueLines(
                                                        clueMemory,
                                                        result.topicClues.joinToString("\n")
                                                    )
                                                }

                                                if (result.guesses.isNotEmpty()) {
                                                    guessMemory = mergeUniqueLines(
                                                        guessMemory,
                                                        result.guesses.joinToString("\n") { guess ->
                                                            "${guess.word} ${formatScore(guess.score)}"
                                                        }
                                                    )
                                                }

                                                historyList = addHistoryItem(
                                                    historyList = historyList,
                                                    aiText = result.aiText,
                                                    candidates = result.candidates,
                                                    clueMemory = clueMemory,
                                                    guessMemory = guessMemory
                                                )

                                                supplementClue = ""
                                                supplementGuessWord = ""
                                                supplementGuessScore = ""

                                                statusText = "补充分析完成。"
                                                isRefining = false
                                            }
                                        },
                                        onError = { error: String ->
                                            runOnUiThread {
                                                aiResult = """
补充分析失败。

错误信息：
$error

你可以：
1. 检查新线索是否为空
2. 检查高分词和相似度是否一起填写
3. 等 30 秒后重新点击“补充信息再分析”
4. 检查 Render 后端是否正常
                                                """.trimIndent()

                                                statusText = "补充分析失败，可以修改信息后重试。"
                                                isRefining = false
                                            }
                                        }
                                    )
                                }
                            ) {
                                Text(if (isRefining) "补充分析中..." else "补充信息再分析")

                        }
                    }

                    if (candidates.isNotEmpty()) {
                        SectionCard(title = "AI 候选答案") {
                            candidates.forEachIndexed { index, candidate ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(14.dp),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
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

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            OutlinedButton(
                                                modifier = Modifier.weight(1f),
                                                enabled = !isAnalyzing && !isRefining,
                                                onClick = {
                                                    supplementGuessWord = candidate.word
                                                    supplementGuessScore = ""
                                                    statusText = "已填入候选词：${candidate.word}，请输入相似度。"
                                                }
                                            ) {
                                                Text("作为高分词")
                                            }

                                            Button(
                                                modifier = Modifier.weight(1f),
                                                enabled = !isAnalyzing && !isRefining,
                                                onClick = {
                                                    clueMemory = mergeUniqueLines(
                                                        clueMemory,
                                                        "重点考虑候选词：${candidate.word}"
                                                    )
                                                    statusText = "已把 ${candidate.word} 加入当前题目信息。"
                                                }
                                            ) {
                                                Text("重点考虑")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    SectionCard(title = "AI 原文分析结果") {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            OutlinedButton(
                                modifier = Modifier.weight(1f),
                                enabled = aiResult.isNotBlank() && aiResult != "暂无 AI 分析结果。",
                                onClick = {
                                    copyTextToClipboard(aiResult)
                                }
                            ) {
                                Text("复制结果")
                            }

                            Button(
                                modifier = Modifier.weight(1f),
                                enabled = aiResult.isNotBlank() && aiResult != "暂无 AI 分析结果。",
                                onClick = {
                                    shareText(aiResult)
                                }
                            ) {
                                Text("分享结果")
                            }
                        }

                        OutlinedButton(
                            modifier = Modifier.fillMaxWidth(),
                            enabled = aiResult.isNotBlank() && aiResult != "暂无 AI 分析结果。",
                            onClick = {
                                aiResult = "暂无 AI 分析结果。"
                                candidates = emptyList()
                                statusText = "已清空 AI 结果，但保留当前截图和题目信息。"
                            }
                        ) {
                            Text("只清空 AI 结果")
                        }

                        OutlinedTextField(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(320.dp),
                            value = aiResult,
                            onValueChange = { aiResult = it },
                            label = {
                                Text("AI 原文分析结果")
                            }
                        )
                    }
                    if (historyList.isNotEmpty()) {
                        SectionCard(title = "历史记录") {
                            historyList.forEachIndexed { index, item ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(12.dp),
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = "${index + 1}. ${item.title}",
                                            style = MaterialTheme.typography.titleMedium
                                        )

                                        Text(
                                            text = item.time,
                                            style = MaterialTheme.typography.bodySmall
                                        )

                                        Text(
                                            text = "候选答案：${item.candidates.take(3).joinToString("、") { it.word }}",
                                            style = MaterialTheme.typography.bodySmall
                                        )

                                        Row(
                                            modifier = Modifier.fillMaxWidth(),
                                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                                        ) {
                                            OutlinedButton(
                                                modifier = Modifier.weight(1f),
                                                onClick = {
                                                    aiResult = item.aiText
                                                    candidates = item.candidates
                                                    clueMemory = item.clueMemory
                                                    guessMemory = item.guessMemory
                                                    statusText = "已恢复历史记录：${item.title}"
                                                }
                                            ) {
                                                Text("恢复")
                                            }

                                            Button(
                                                modifier = Modifier.weight(1f),
                                                onClick = {
                                                    shareText(item.aiText)
                                                }
                                            ) {
                                                Text("分享")
                                            }
                                        }
                                    }
                                }
                            }

                            OutlinedButton(
                                modifier = Modifier.fillMaxWidth(),
                                onClick = {
                                    historyList = emptyList()
                                    statusText = "历史记录已清空。"
                                }
                            ) {
                                Text("清空历史记录")
                            }
                        }
                    }
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

            postJson(
                endpoint = "/api/analyze-image",
                json = json,
                onSuccess = onSuccess,
                onError = onError
            )
        } catch (error: Exception) {
            onError(error.message ?: "未知错误")
        }
    }

    private fun analyzeText(
        clues: String,
        guessText: String,
        onSuccess: (AiParsedResult) -> Unit,
        onError: (String) -> Unit
    ) {
        try {
            val guesses = parseGuessTextToJsonArray(guessText)

            val json = JSONObject()
            json.put("mode", "semantic")
            json.put("clues", clues)
            json.put("guesses", guesses)
            json.put("customWords", JSONArray())

            postJson(
                endpoint = "/api/analyze",
                json = json,
                onSuccess = onSuccess,
                onError = onError
            )
        } catch (error: Exception) {
            onError(error.message ?: "未知错误")
        }
    }

    private fun checkBackendHealth(
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        val request = Request.Builder()
            .url(backendUrl)
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                onError(
                    e.message ?: "网络请求失败，可能是 Render 后端正在休眠。"
                )
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val bodyText = it.body?.string() ?: ""

                    if (!it.isSuccessful) {
                        onError("HTTP ${it.code}: $bodyText")
                        return
                    }

                    try {
                        val json = JSONObject(bodyText)
                        val ok = json.optBoolean("ok", false)
                        val message = json.optString("message", "")

                        if (ok) {
                            onSuccess("后端正常运行：$message")
                        } else {
                            onSuccess("后端已响应，但状态未知。")
                        }
                    } catch (error: Exception) {
                        onSuccess("后端已响应。")
                    }
                }
            }
        })
    }

    private fun postJson(
        endpoint: String,
        json: JSONObject,
        onSuccess: (AiParsedResult) -> Unit,
        onError: (String) -> Unit
    ) {
        val mediaType = "application/json; charset=utf-8".toMediaType()
        val requestBody = json.toString().toRequestBody(mediaType)

        val request = Request.Builder()
            .url("$backendUrl$endpoint")
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                onError(
                    e.message ?: "网络请求失败。可能是 Render 后端正在休眠或网络连接不稳定，请稍后重试。"
                )
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    val bodyText = it.body?.string() ?: ""

                    if (!it.isSuccessful) {
                        onError("HTTP ${it.code}: $bodyText")
                        return
                    }

                    try {
                        val parsedResult = parseAiResponse(bodyText)
                        onSuccess(parsedResult)
                    } catch (error: Exception) {
                        onSuccess(
                            AiParsedResult(
                                aiText = bodyText,
                                candidates = emptyList(),
                                topicClues = emptyList(),
                                guesses = emptyList()
                            )
                        )
                    }
                }
            }
        })
    }

    private fun parseAiResponse(bodyText: String): AiParsedResult {
        val responseJson = JSONObject(bodyText)

        val aiText = responseJson.optString("aiText", bodyText)
        val aiJson = responseJson.optJSONObject("aiJson")

        val candidates = parseCandidates(aiJson)
        val topicClues = parseTopicClues(aiJson)
        val guesses = parseGuesses(aiJson)

        return AiParsedResult(
            aiText = aiText.ifBlank { bodyText },
            candidates = candidates,
            topicClues = topicClues,
            guesses = guesses
        )
    }

    private fun parseCandidates(aiJson: JSONObject?): List<AiCandidate> {
        val candidatesJsonArray = aiJson?.optJSONArray("candidates") ?: return emptyList()
        val candidateList = mutableListOf<AiCandidate>()

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

        return candidateList
    }

    private fun parseTopicClues(aiJson: JSONObject?): List<String> {
        val array = aiJson?.optJSONArray("topicClues") ?: return emptyList()
        val result = mutableListOf<String>()

        for (index in 0 until array.length()) {
            val clue = array.optString(index)
            if (clue.isNotBlank()) {
                result.add(clue)
            }
        }

        return result
    }

    private fun parseGuesses(aiJson: JSONObject?): List<AiGuess> {
        val array = aiJson?.optJSONArray("guesses") ?: return emptyList()
        val result = mutableListOf<AiGuess>()

        for (index in 0 until array.length()) {
            val item = array.optJSONObject(index) ?: continue
            val word = item.optString("word")
            val score = item.optDouble("score", -1.0)

            if (word.isNotBlank() && score >= 0.0) {
                result.add(
                    AiGuess(
                        word = word,
                        score = score
                    )
                )
            }
        }

        return result
    }

    private fun parseGuessTextToJsonArray(guessText: String): JSONArray {
        val array = JSONArray()

        guessText
            .lines()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .forEach { line ->
                val parts = line.split(Regex("\\s+"))
                if (parts.size >= 2) {
                    val score = parts.last().toDoubleOrNull()
                    val word = parts.dropLast(1).joinToString("")

                    if (word.isNotBlank() && score != null) {
                        val item = JSONObject()
                        item.put("word", word)
                        item.put("score", score)
                        array.put(item)
                    }
                }
            }

        return array
    }

    private fun copyTextToClipboard(text: String) {
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText("AI Analysis Result", text)
        clipboard.setPrimaryClip(clip)

        Toast.makeText(this, "AI 结果已复制", Toast.LENGTH_SHORT).show()
    }

    private fun shareText(text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, "Floating Guess Assistant Result")
            putExtra(Intent.EXTRA_TEXT, text)
        }

        startActivity(Intent.createChooser(intent, "分享 AI 结果"))
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

    private fun mergeUniqueLines(existingText: String, newText: String): String {
        val existingLines = existingText
            .lines()
            .map { it.trim() }
            .filter { it.isNotBlank() }

        val newLines = newText
            .lines()
            .map { it.trim() }
            .filter { it.isNotBlank() }

        val seen = existingLines.toMutableSet()
        val result = existingLines.toMutableList()

        newLines.forEach { line ->
            if (!seen.contains(line)) {
                seen.add(line)
                result.add(line)
            }
        }

        return result.joinToString("\n")
    }

    private fun candidatesToJsonString(candidates: List<AiCandidate>): String {
        val array = JSONArray()

        candidates.forEach { candidate ->
            val item = JSONObject()
            item.put("word", candidate.word)
            item.put("confidence", candidate.confidence)
            item.put("reason", candidate.reason)

            val keywordsArray = JSONArray()
            candidate.keywords.forEach { keyword ->
                keywordsArray.put(keyword)
            }

            item.put("keywords", keywordsArray)
            array.put(item)
        }

        return array.toString()
    }

    private fun candidatesFromJsonString(text: String): List<AiCandidate> {
        return try {
            val array = JSONArray(text)
            val result = mutableListOf<AiCandidate>()

            for (index in 0 until array.length()) {
                val item = array.optJSONObject(index) ?: continue

                val keywordsArray = item.optJSONArray("keywords")
                val keywords = mutableListOf<String>()

                if (keywordsArray != null) {
                    for (keywordIndex in 0 until keywordsArray.length()) {
                        val keyword = keywordsArray.optString(keywordIndex)
                        if (keyword.isNotBlank()) {
                            keywords.add(keyword)
                        }
                    }
                }

                result.add(
                    AiCandidate(
                        word = item.optString("word", "未知候选词"),
                        confidence = item.optInt("confidence", 0),
                        reason = item.optString("reason", ""),
                        keywords = keywords
                    )
                )
            }

            result
        } catch (error: Exception) {
            emptyList()
        }
    }

    private fun addHistoryItem(
        historyList: List<HistoryItem>,
        aiText: String,
        candidates: List<AiCandidate>,
        clueMemory: String,
        guessMemory: String
    ): List<HistoryItem> {
        val time = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date())
        val title = candidates.firstOrNull()?.word ?: "AI 分析结果"

        val newItem = HistoryItem(
            time = time,
            title = title,
            aiText = aiText,
            candidates = candidates,
            clueMemory = clueMemory,
            guessMemory = guessMemory
        )

        return listOf(newItem) + historyList.take(9)
    }

    private fun historyToJsonString(historyList: List<HistoryItem>): String {
        val array = JSONArray()

        historyList.forEach { item ->
            val obj = JSONObject()
            obj.put("time", item.time)
            obj.put("title", item.title)
            obj.put("aiText", item.aiText)
            obj.put("candidates", JSONArray(candidatesToJsonString(item.candidates)))
            obj.put("clueMemory", item.clueMemory)
            obj.put("guessMemory", item.guessMemory)
            array.put(obj)
        }

        return array.toString()
    }

    private fun historyFromJsonString(text: String): List<HistoryItem> {
        return try {
            val array = JSONArray(text)
            val result = mutableListOf<HistoryItem>()

            for (index in 0 until array.length()) {
                val obj = array.optJSONObject(index) ?: continue

                result.add(
                    HistoryItem(
                        time = obj.optString("time", ""),
                        title = obj.optString("title", "AI 分析结果"),
                        aiText = obj.optString("aiText", ""),
                        candidates = candidatesFromJsonString(
                            obj.optJSONArray("candidates")?.toString() ?: "[]"
                        ),
                        clueMemory = obj.optString("clueMemory", ""),
                        guessMemory = obj.optString("guessMemory", "")
                    )
                )
            }

            result
        } catch (error: Exception) {
            emptyList()
        }
    }

    private fun formatScore(score: Double): String {
        return if (score % 1.0 == 0.0) {
            score.toInt().toString()
        } else {
            "%.1f".format(score)
        }
    }
}
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

                var clueMemory by remember { mutableStateOf("") }
                var guessMemory by remember { mutableStateOf("") }

                var supplementClue by remember { mutableStateOf("") }
                var supplementGuessWord by remember { mutableStateOf("") }
                var supplementGuessScore by remember { mutableStateOf("") }

                var statusText by remember { mutableStateOf("请选择一张直播截图。") }
                var isAnalyzing by remember { mutableStateOf(false) }
                var isRefining by remember { mutableStateOf(false) }

                val imagePicker = rememberLauncherForActivityResult(
                    contract = ActivityResultContracts.GetContent()
                ) { uri ->
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

                    Text(
                        text = "Floating Guess Assistant",
                        style = MaterialTheme.typography.headlineMedium
                    )

                    Text(
                        text = "原生 Android v0.1：选择截图、AI 分析、补充线索再分析。",
                        style = MaterialTheme.typography.bodyMedium
                    )

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
                                    onSuccess = { result ->
                                        runOnUiThread {
                                            aiResult = result.aiText
                                            candidates = result.candidates
                                            clueMemory = result.topicClues.joinToString("\n")
                                            guessMemory = result.guesses.joinToString("\n") {
                                                "${it.word} ${formatScore(it.score)}"
                                            }

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

                    if (clueMemory.isNotBlank() || guessMemory.isNotBlank()) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                        ) {
                            Column(
                                modifier = Modifier.padding(14.dp),
                                verticalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Text(
                                    text = "当前题目信息",
                                    style = MaterialTheme.typography.titleMedium
                                )

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
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = "补充新信息后重新分析",
                                style = MaterialTheme.typography.titleMedium
                            )

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
                                        onSuccess = { result ->
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
                                                        result.guesses.joinToString("\n") {
                                                            "${it.word} ${formatScore(it.score)}"
                                                        }
                                                    )
                                                }

                                                supplementClue = ""
                                                supplementGuessWord = ""
                                                supplementGuessScore = ""

                                                statusText = "补充分析完成。"
                                                isRefining = false
                                            }
                                        },
                                        onError = { error ->
                                            runOnUiThread {
                                                aiResult = "补充分析失败：$error"
                                                statusText = "补充分析失败。"
                                                isRefining = false
                                            }
                                        }
                                    )
                                }
                            ) {
                                Text(if (isRefining) "补充分析中..." else "补充信息再分析")
                            }
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
                            Text("AI 原文分析结果")
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

    private fun formatScore(score: Double): String {
        return if (score % 1.0 == 0.0) {
            score.toInt().toString()
        } else {
            "%.1f".format(score)
        }
    }
}
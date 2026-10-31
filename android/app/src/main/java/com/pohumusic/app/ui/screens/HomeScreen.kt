package com.pohumusic.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.pohumusic.app.model.RecommendationItem
import com.pohumusic.app.model.Track
import com.pohumusic.app.network.ApiClient
import com.pohumusic.app.ui.theme.LocalAccentColor
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    isOffline: Boolean,
    onTrackSelect: (Track, List<Track>) -> Unit
) {
    val accent = LocalAccentColor.current
    val scope = rememberCoroutineScope()

    var activity by remember { mutableStateOf("working") }
    var character by remember { mutableStateOf("favorite") }
    var mood by remember { mutableStateOf("calm") }
    var language by remember { mutableStateOf("any") }

    var isLoading by remember { mutableStateOf(false) }
    var errorText by remember { mutableStateOf<String?>(null) }
    var tracks by remember { mutableStateOf<List<RecommendationItem>>(emptyList()) }

    val fetchRecommendations = {
        scope.launch {
            if (isOffline) {
                errorText = "Нет подключения к интернету. Рекомендации недоступны в оффлайн-режиме."
                return@launch
            }
            isLoading = true
            errorText = null
            try {
                val res = ApiClient.service.getRecommendations(activity, character, mood, language)
                if (res.isSuccessful && res.body() != null) {
                    tracks = res.body()?.items ?: emptyList()
                } else {
                    errorText = "Не удалось загрузить рекомендации: код ${res.code()}"
                }
            } catch (e: Exception) {
                errorText = e.localizedMessage ?: "Сетевая ошибка"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(activity, character, mood, language, isOffline) {
        fetchRecommendations()
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Для тебя",
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "Персональный поток на основе ваших предпочтений",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Mode Chips: Activity
        item {
            Text("Занятие", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(6.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val activities = listOf(
                    "waking_up" to "Просыпаюсь",
                    "commuting" to "В дороге",
                    "working" to "Работаю",
                    "workout" to "Тренируюсь",
                    "sleeping" to "Засыпаю"
                )
                items(activities) { (key, label) ->
                    FilterChip(
                        selected = activity == key,
                        onClick = { activity = key },
                        label = { Text(label) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = accent.copy(alpha = 0.25f),
                            selectedLabelColor = accent
                        )
                    )
                }
            }
        }

        // Mode Chips: Mood
        item {
            Text("Настроение", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(6.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                val moods = listOf(
                    "energetic" to "Бодрое",
                    "cheerful" to "Весёлое",
                    "calm" to "Спокойное",
                    "melancholic" to "Грустное"
                )
                items(moods) { (key, label) ->
                    FilterChip(
                        selected = mood == key,
                        onClick = { mood = key },
                        label = { Text(label) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = accent.copy(alpha = 0.25f),
                            selectedLabelColor = accent
                        )
                    )
                }
            }
        }

        // Content States
        when {
            isOffline -> {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.WifiOff,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(48.dp)
                        )
                        Text("Оффлайн режим", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "Проверьте соединение с сетью для загрузки потока",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            isLoading -> {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = accent)
                    }
                }
            }
            errorText != null -> {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(errorText!!, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
                        Button(onClick = { fetchRecommendations() }) {
                            Icon(Icons.Filled.Refresh, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("Повторить")
                        }
                    }
                }
            }
            tracks.isEmpty() -> {
                item {
                    Text(
                        "Нет доступных треков для выбранного фильтра.",
                        modifier = Modifier.padding(vertical = 24.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            else -> {
                item {
                    Text(
                        "Рекомендованные треки (${tracks.size})",
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold)
                    )
                }

                items(tracks) { item ->
                    val track = item.track
                    val allTracks = tracks.map { it.track }

                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { onTrackSelect(track, allTracks) },
                        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            AsyncImage(
                                model = track.displayArtworkUrl,
                                contentDescription = track.displayTitle,
                                modifier = Modifier
                                    .size(52.dp)
                                    .clip(RoundedCornerShape(8.dp)),
                                contentScale = ContentScale.Crop
                            )

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = track.displayTitle,
                                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = track.displayArtist,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = item.displayReason,
                                    style = MaterialTheme.typography.labelSmall.copy(fontSize = 10.sp),
                                    color = accent
                                )
                            }

                            FilledIconButton(
                                onClick = { onTrackSelect(track, allTracks) },
                                modifier = Modifier.size(36.dp),
                                colors = IconButtonDefaults.filledIconButtonColors(containerColor = accent)
                            ) {
                                Icon(Icons.Filled.PlayArrow, contentDescription = "Play", modifier = Modifier.size(20.dp))
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(modifier = Modifier.height(72.dp)) }
    }
}

package com.pohumusic.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.pohumusic.app.model.AccessState
import com.pohumusic.app.model.ProviderSource
import com.pohumusic.app.model.Track
import com.pohumusic.app.network.ApiClient
import com.pohumusic.app.ui.theme.LocalAccentColor
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    onTrackSelect: (Track, List<Track>) -> Unit
) {
    val accent = LocalAccentColor.current
    val scope = rememberCoroutineScope()

    var query by remember { mutableStateOf("") }
    var providerFilter by remember { mutableStateOf("all") }
    var isLoading by remember { mutableStateOf(false) }
    var searchResults by remember { mutableStateOf<List<Track>>(emptyList()) }
    var errorText by remember { mutableStateOf<String?>(null) }

    fun executeSearch(q: String, prov: String) {
        scope.launch {
            isLoading = true
            errorText = null
            try {
                val res = ApiClient.service.searchTracks(q, prov)
                if (res.isSuccessful && res.body() != null) {
                    val rawTracks = res.body()!!["tracks"] as? List<Map<String, Any>> ?: emptyList()
                    searchResults = rawTracks.map { map ->
                        Track(
                            id = map["id"] as? String ?: "",
                            provider = if (map["provider"] == "soundcloud") ProviderSource.SOUNDCLOUD else ProviderSource.YOUTUBE,
                            title = map["title"] as? String ?: "Без названия",
                            artist = map["artist"] as? String ?: (map["artistName"] as? String) ?: "Неизвестный исполнитель",
                            artistName = map["artistName"] as? String,
                            album = map["album"] as? String ?: map["albumTitle"] as? String,
                            durationSeconds = (map["durationSeconds"] as? Number)?.toInt()
                                ?: ((map["durationMs"] as? Number)?.toLong()?.div(1000L))?.toInt()
                                ?: 180,
                            durationMs = (map["durationMs"] as? Number)?.toLong(),
                            artworkUrl = map["artworkUrl"] as? String,
                            externalUrl = map["externalUrl"] as? String ?: (map["permalinkUrl"] as? String) ?: "",
                            permalinkUrl = map["permalinkUrl"] as? String,
                            accessState = when (map["accessState"]) {
                                "preview" -> AccessState.PREVIEW
                                "blocked" -> AccessState.BLOCKED
                                else -> AccessState.PLAYABLE
                            },
                            previewSeconds = (map["previewSeconds"] as? Number)?.toInt(),
                            rawPlayCount = (map["rawPlayCount"] as? Number)?.toLong(),
                            displayScore = (map["displayScore"] as? Number)?.toLong()
                        )
                    }
                } else {
                    errorText = "Ошибка поиска: код ${res.code()}"
                }
            } catch (e: Exception) {
                errorText = e.localizedMessage ?: "Сетевая ошибка"
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        executeSearch("", "all")
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Поиск",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
        )

        OutlinedTextField(
            value = query,
            onValueChange = {
                query = it
                executeSearch(it, providerFilter)
            },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Трек, исполнитель или альбом...") },
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = accent) },
            trailingIcon = {
                if (query.isNotEmpty()) {
                    IconButton(onClick = {
                        query = ""
                        executeSearch("", providerFilter)
                    }) {
                        Icon(Icons.Filled.Close, contentDescription = "Очистить")
                    }
                }
            },
            shape = RoundedCornerShape(12.dp),
            singleLine = true
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all" to "Все", "soundcloud" to "SoundCloud", "youtube" to "YouTube").forEach { (key, label) ->
                FilterChip(
                    selected = providerFilter == key,
                    onClick = {
                        providerFilter = key
                        executeSearch(query, key)
                    },
                    label = { Text(label) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = accent.copy(alpha = 0.25f),
                        selectedLabelColor = accent
                    )
                )
            }
        }

        when {
            isLoading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = accent)
                }
            }
            errorText != null -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(errorText!!, color = MaterialTheme.colorScheme.error)
                }
            }
            searchResults.isEmpty() -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Ничего не найдено", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(searchResults) { track ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .clickable { onTrackSelect(track, searchResults) },
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
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
                                        .size(48.dp)
                                        .clip(RoundedCornerShape(6.dp)),
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
                                        text = "${track.displayArtist} · ${if (track.provider == ProviderSource.SOUNDCLOUD) "SoundCloud" else "YouTube"}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }

                                if (track.isPlayable) {
                                    IconButton(onClick = { onTrackSelect(track, searchResults) }) {
                                        Icon(Icons.Filled.PlayArrow, contentDescription = "Play", tint = accent)
                                    }
                                } else {
                                    Text(
                                        "Заблокирован",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.error
                                    )
                                }
                            }
                        }
                    }
                    item { Spacer(modifier = Modifier.height(72.dp)) }
                }
            }
        }
    }
}

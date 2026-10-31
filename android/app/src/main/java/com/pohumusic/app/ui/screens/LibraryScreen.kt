package com.pohumusic.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
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
import com.pohumusic.app.model.HistoryItem
import com.pohumusic.app.model.Playlist
import com.pohumusic.app.model.Track
import com.pohumusic.app.network.ApiClient
import com.pohumusic.app.ui.theme.LocalAccentColor
import kotlinx.coroutines.launch

@Composable
fun LibraryScreen(
    onTrackSelect: (Track, List<Track>) -> Unit
) {
    val accent = LocalAccentColor.current
    val scope = rememberCoroutineScope()

    var selectedTab by remember { mutableIntStateOf(0) }
    var playlists by remember { mutableStateOf<List<Playlist>>(emptyList()) }
    var historyItems by remember { mutableStateOf<List<HistoryItem>>(emptyList()) }
    var favoritesCount by remember { mutableIntStateOf(0) }
    var isLoading by remember { mutableStateOf(false) }
    var noticeMessage by remember { mutableStateOf<String?>(null) }

    val loadLibrary = {
        scope.launch {
            isLoading = true
            try {
                val plRes = ApiClient.service.getPlaylists()
                if (plRes.isSuccessful && plRes.body() != null) {
                    val raw = plRes.body()!!["playlists"] as? List<Map<String, Any>> ?: emptyList()
                    playlists = raw.map {
                        Playlist(
                            id = it["id"] as? String ?: "",
                            userId = it["userId"] as? String ?: "",
                            title = it["title"] as? String ?: "Плейлист",
                            description = it["description"] as? String,
                            coverUrl = it["coverUrl"] as? String,
                            isPublic = it["isPublic"] as? Boolean ?: false,
                            tracksCount = (it["tracksCount"] as? Number)?.toInt() ?: 0,
                            shareId = it["shareId"] as? String,
                            createdAt = it["createdAt"] as? String ?: "",
                            updatedAt = it["updatedAt"] as? String ?: ""
                        )
                    }
                }

                val histRes = ApiClient.service.getHistory()
                if (histRes.isSuccessful && histRes.body() != null) {
                    val rawHist = histRes.body()!!["history"] as? List<Map<String, Any>> ?: emptyList()
                    historyItems = rawHist.take(15).map {
                        HistoryItem(
                            id = it["id"] as? String ?: "",
                            trackId = it["trackId"] as? String ?: "",
                            trackTitle = it["trackTitle"] as? String ?: "",
                            trackArtist = it["trackArtist"] as? String ?: "",
                            trackArtworkUrl = it["trackArtworkUrl"] as? String,
                            provider = com.pohumusic.app.model.ProviderSource.SOUNDCLOUD,
                            listenedSeconds = (it["listenedSeconds"] as? Number)?.toInt() ?: 0,
                            completed = it["completed"] as? Boolean ?: true,
                            playedAt = it["playedAt"] as? String ?: ""
                        )
                    }
                }

                val favRes = ApiClient.service.getFavorites()
                if (favRes.isSuccessful && favRes.body() != null) {
                    val favList = favRes.body()!!["favorites"] as? List<*> ?: emptyList<Any>()
                    favoritesCount = favList.size
                }
            } catch (e: Exception) {
                noticeMessage = e.localizedMessage
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadLibrary()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Моя музыка",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
        )

        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            contentColor = accent,
            modifier = Modifier.clip(RoundedCornerShape(10.dp))
        ) {
            Tab(
                selected = selectedTab == 0,
                onClick = { selectedTab = 0 },
                text = { Text("Плейлисты (${playlists.size}/10)") }
            )
            Tab(
                selected = selectedTab == 1,
                onClick = { selectedTab = 1 },
                text = { Text("История (${historyItems.size}/15)") }
            )
            Tab(
                selected = selectedTab == 2,
                onClick = { selectedTab = 2 },
                text = { Text("Избранное ($favoritesCount)") }
            )
        }

        noticeMessage?.let {
            Text(it, color = accent, style = MaterialTheme.typography.bodySmall)
        }

        when (selectedTab) {
            0 -> {
                // Playlists (Max 10 per user rule)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Ваши плейлисты (макс. 10)",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Button(
                        onClick = {
                            if (playlists.size >= 10) {
                                noticeMessage = "Достигнут лимит: максимум 10 плейлистов на аккаунт."
                                return@Button
                            }
                            scope.launch {
                                try {
                                    val res = ApiClient.service.createPlaylist(
                                        mapOf("title" to "Новый плейлист #${playlists.size + 1}")
                                    )
                                    if (res.isSuccessful) {
                                        loadLibrary()
                                    } else {
                                        noticeMessage = "Ошибка создания: код ${res.code()}"
                                    }
                                } catch (e: Exception) {
                                    noticeMessage = e.localizedMessage
                                }
                            }
                        },
                        enabled = playlists.size < 10,
                        colors = ButtonDefaults.buttonColors(containerColor = accent)
                    ) {
                        Icon(Icons.Filled.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Создать", fontSize = 12.sp)
                    }
                }

                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(playlists) { pl ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp)),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                        ) {
                            Row(
                                modifier = Modifier.padding(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                AsyncImage(
                                    model = pl.coverUrl,
                                    contentDescription = pl.title,
                                    modifier = Modifier
                                        .size(48.dp)
                                        .clip(RoundedCornerShape(8.dp)),
                                    contentScale = ContentScale.Crop
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(pl.title, fontWeight = FontWeight.SemiBold)
                                    Text(
                                        "${pl.tracksCount} треков · ${if (pl.isPublic) "Публичный" else "Приватный"}",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                if (pl.shareId != null) {
                                    IconButton(onClick = {
                                        noticeMessage = "Ссылка на плейлист: pohumusic://playlist/${pl.shareId}"
                                    }) {
                                        Icon(Icons.Filled.Share, contentDescription = "Поделиться", tint = accent)
                                    }
                                }
                            }
                        }
                    }
                    item { Spacer(modifier = Modifier.height(72.dp)) }
                }
            }
            1 -> {
                // History (Last 15 unique tracks rule)
                Text(
                    "Последние 15 уникальных прослушиваний",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(historyItems) { item ->
                        Surface(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp)),
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
                        ) {
                            Row(
                                modifier = Modifier.padding(10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                AsyncImage(
                                    model = item.trackArtworkUrl,
                                    contentDescription = item.trackTitle,
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(RoundedCornerShape(6.dp)),
                                    contentScale = ContentScale.Crop
                                )
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(item.trackTitle, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                    Text(
                                        item.trackArtist,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }
                    item { Spacer(modifier = Modifier.height(72.dp)) }
                }
            }
            else -> {
                Text(
                    "Избранные треки синхронизируются с облачной базой D1",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

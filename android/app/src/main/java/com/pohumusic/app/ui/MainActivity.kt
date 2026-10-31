package com.pohumusic.app.ui

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.pohumusic.app.PohuMusicApp
import com.pohumusic.app.model.Track
import com.pohumusic.app.model.User
import com.pohumusic.app.network.NetworkMonitor
import com.pohumusic.app.ui.components.*
import com.pohumusic.app.ui.screens.*
import com.pohumusic.app.ui.theme.AccentBlue
import com.pohumusic.app.ui.theme.PohuMusicTheme

class MainActivity : ComponentActivity() {
    private val playbackManager by lazy {
        (application as PohuMusicApp).playbackManager
    }
    private val networkMonitor by lazy {
        NetworkMonitor(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            var selectedAccentColor by remember { mutableStateOf(AccentBlue) }
            val isOnline by networkMonitor.isOnline.collectAsState(initial = true)
            val playerState by playbackManager.uiState.collectAsState()

            var currentUser by remember {
                mutableStateOf(
                    User(
                        id = "usr_demo",
                        email = "san4ez.fedorov@gmail.com",
                        username = "sanchez_fedorov",
                        displayName = "Александр Фёдоров",
                        role = "user",
                        emailVerified = true
                    )
                )
            }
            var isAuthenticated by remember { mutableStateOf(true) }

            var currentTab by remember { mutableStateOf("home") }
            var isFullScreenPlayerVisible by remember { mutableStateOf(false) }
            var showEqualizer by remember { mutableStateOf(false) }
            var showSleepTimer by remember { mutableStateOf(false) }

            PohuMusicTheme(accentColor = selectedAccentColor) {
                if (!isAuthenticated) {
                    AuthScreen(
                        onAuthSuccess = { user, token ->
                            currentUser = user
                            isAuthenticated = true
                        }
                    )
                } else {
                    Scaffold(
                        bottomBar = {
                            Column {
                                // Compact MiniPlayer docked above bottom bar
                                MiniPlayer(
                                    track = playerState.currentTrack,
                                    isPlaying = playerState.isPlaying,
                                    onPlayPauseClick = { playbackManager.togglePlayPause() },
                                    onNextClick = { playbackManager.playNext() },
                                    onClick = { isFullScreenPlayerVisible = true }
                                )

                                NavigationBar(
                                    containerColor = MaterialTheme.colorScheme.surface,
                                    contentColor = selectedAccentColor,
                                    tonalElevation = 8.dp
                                ) {
                                    NavigationBarItem(
                                        selected = currentTab == "home",
                                        onClick = { currentTab = "home" },
                                        icon = { Icon(Icons.Filled.Home, contentDescription = null) },
                                        label = { Text("Главная") },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = selectedAccentColor,
                                            selectedTextColor = selectedAccentColor,
                                            indicatorColor = selectedAccentColor.copy(alpha = 0.15f)
                                        )
                                    )
                                    NavigationBarItem(
                                        selected = currentTab == "search",
                                        onClick = { currentTab = "search" },
                                        icon = { Icon(Icons.Filled.Search, contentDescription = null) },
                                        label = { Text("Поиск") },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = selectedAccentColor,
                                            selectedTextColor = selectedAccentColor,
                                            indicatorColor = selectedAccentColor.copy(alpha = 0.15f)
                                        )
                                    )
                                    NavigationBarItem(
                                        selected = currentTab == "library",
                                        onClick = { currentTab = "library" },
                                        icon = { Icon(Icons.Filled.LibraryMusic, contentDescription = null) },
                                        label = { Text("Моя музыка") },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = selectedAccentColor,
                                            selectedTextColor = selectedAccentColor,
                                            indicatorColor = selectedAccentColor.copy(alpha = 0.15f)
                                        )
                                    )
                                    NavigationBarItem(
                                        selected = currentTab == "profile",
                                        onClick = { currentTab = "profile" },
                                        icon = { Icon(Icons.Filled.Person, contentDescription = null) },
                                        label = { Text("Профиль") },
                                        colors = NavigationBarItemDefaults.colors(
                                            selectedIconColor = selectedAccentColor,
                                            selectedTextColor = selectedAccentColor,
                                            indicatorColor = selectedAccentColor.copy(alpha = 0.15f)
                                        )
                                    )
                                }
                            }
                        }
                    ) { innerPadding ->
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(innerPadding)
                                .background(MaterialTheme.colorScheme.background)
                        ) {
                            when (currentTab) {
                                "home" -> HomeScreen(
                                    isOffline = !isOnline,
                                    onTrackSelect = { track, list ->
                                        playbackManager.playTrack(track, list, isRecommendationSource = true)
                                    }
                                )
                                "search" -> SearchScreen(
                                    onTrackSelect = { track, list ->
                                        playbackManager.playTrack(track, list, isRecommendationSource = false)
                                    }
                                )
                                "library" -> LibraryScreen(
                                    onTrackSelect = { track, list ->
                                        playbackManager.playTrack(track, list, isRecommendationSource = false)
                                    }
                                )
                                "profile" -> ProfileScreen(
                                    user = currentUser,
                                    currentAccent = selectedAccentColor,
                                    onSelectAccent = { selectedAccentColor = it },
                                    onLogout = { isAuthenticated = false }
                                )
                            }
                        }
                    }

                    // Full Screen Modal Player
                    if (isFullScreenPlayerVisible && playerState.currentTrack != null) {
                        FullScreenPlayer(
                            track = playerState.currentTrack!!,
                            isPlaying = playerState.isPlaying,
                            positionMs = playerState.currentPositionMs,
                            durationMs = playerState.durationMs,
                            isShuffle = playerState.isShuffleEnabled,
                            isRepeat = playerState.isRepeatEnabled,
                            isFavorite = false,
                            onPlayPause = { playbackManager.togglePlayPause() },
                            onNext = { playbackManager.playNext() },
                            onPrev = { playbackManager.playPrevious() },
                            onSeek = { playbackManager.seekTo(it) },
                            onToggleShuffle = { playbackManager.toggleShuffle() },
                            onToggleRepeat = { playbackManager.toggleRepeat() },
                            onToggleFavorite = {},
                            onRecommendSimilar = {},
                            onOpenEqualizer = { showEqualizer = true },
                            onOpenSleepTimer = { showSleepTimer = true },
                            onDismiss = { isFullScreenPlayerVisible = false }
                        )
                    }

                    // Equalizer Dialog
                    if (showEqualizer) {
                        EqualizerDialog(
                            isEnabled = playerState.isEqualizerEnabled,
                            onToggle = { playbackManager.toggleEqualizer(it) },
                            onDismiss = { showEqualizer = false }
                        )
                    }

                    // Sleep Timer Dialog
                    if (showSleepTimer) {
                        SleepTimerDialog(
                            currentMinutesLeft = playerState.sleepTimerMinutesLeft,
                            onSetTimer = { playbackManager.setSleepTimer(it) },
                            onDismiss = { showSleepTimer = false }
                        )
                    }
                }
            }
        }
    }
}

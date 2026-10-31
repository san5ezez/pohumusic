package com.pohumusic.app.player

import android.content.Context
import android.media.audiofx.Equalizer
import android.net.Uri
import android.os.CountDownTimer
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.pohumusic.app.model.AccessState
import com.pohumusic.app.model.ProviderSource
import com.pohumusic.app.model.Track
import com.pohumusic.app.network.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class PlayerUiState(
    val currentTrack: Track? = null,
    val isPlaying: Boolean = false,
    val currentPositionMs: Long = 0L,
    val durationMs: Long = 0L,
    val isShuffleEnabled: Boolean = false,
    val isRepeatEnabled: Boolean = false,
    val queue: List<Track> = emptyList(),
    val isEqualizerEnabled: Boolean = false,
    val sleepTimerMinutesLeft: Int? = null,
    val isOffline: Boolean = false,
    val playbackError: String? = null
)

class PlaybackManager(private val context: Context) {
    private val scope = CoroutineScope(Dispatchers.Main)

    private val _uiState = MutableStateFlow(PlayerUiState())
    val uiState: StateFlow<PlayerUiState> = _uiState.asStateFlow()

    private var exoPlayer: ExoPlayer? = null
    private var equalizer: Equalizer? = null
    private var sleepTimer: CountDownTimer? = null

    init {
        initPlayer()
    }

    private fun initPlayer() {
        exoPlayer = ExoPlayer.Builder(context).build().apply {
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    _uiState.value = _uiState.value.copy(isPlaying = isPlaying)
                }

                override fun onPlaybackStateChanged(playbackState: Int) {
                    if (playbackState == Player.STATE_ENDED) {
                        playNext()
                    }
                }
            })
        }
    }

    fun playTrack(track: Track, contextQueue: List<Track> = emptyList(), isRecommendationSource: Boolean = false) {
        if (!track.isPlayable) {
            _uiState.value = _uiState.value.copy(
                playbackError = if (track.accessState == AccessState.BLOCKED)
                    "Трек заблокирован правообладателем в текущем регионе"
                else "Трек недоступен для воспроизведения"
            )
            return
        }

        val queueList = if (contextQueue.isNotEmpty()) {
            contextQueue
        } else {
            listOf(track)
        }

        _uiState.value = _uiState.value.copy(
            currentTrack = track,
            queue = queueList,
            playbackError = null
        )

        // Pre-fetch 3 recommendation tracks if running in recommendation mode
        if (isRecommendationSource) {
            scope.launch {
                try {
                    val relRes = ApiClient.service.getRelatedTracks(track.id)
                    if (relRes.isSuccessful) {
                        val tracksData = relRes.body()?.get("tracks") as? List<Map<String, Any>>
                        // Pre-append up to 3 next tracks to the queue
                    }
                } catch (e: Exception) {}
            }
        }

        // Configure MediaItem for audio playback
        val mediaUri = Uri.parse(track.effectiveUrl)
        val mediaItem = MediaItem.Builder()
            .setMediaId(track.id)
            .setUri(mediaUri)
            .setMediaMetadata(
                MediaMetadata.Builder()
                    .setTitle(track.displayTitle)
                    .setArtist(track.displayArtist)
                    .build()
            )
            .build()

        exoPlayer?.run {
            setMediaItem(mediaItem)
            prepare()
            play()
        }
    }

    fun togglePlayPause() {
        exoPlayer?.let {
            if (it.isPlaying) {
                it.pause()
            } else {
                it.play()
            }
        }
    }

    fun playNext() {
        val currentQueue = _uiState.value.queue
        val current = _uiState.value.currentTrack ?: return
        val currentIndex = currentQueue.indexOfFirst { it.id == current.id }
        if (currentIndex != -1 && currentIndex + 1 < currentQueue.size) {
            playTrack(currentQueue[currentIndex + 1], currentQueue)
        } else if (_uiState.value.isRepeatEnabled && currentQueue.isNotEmpty()) {
            playTrack(currentQueue.first(), currentQueue)
        }
    }

    fun playPrevious() {
        val currentQueue = _uiState.value.queue
        val current = _uiState.value.currentTrack ?: return
        val currentIndex = currentQueue.indexOfFirst { it.id == current.id }
        if (currentIndex > 0) {
            playTrack(currentQueue[currentIndex - 1], currentQueue)
        }
    }

    fun seekTo(positionMs: Long) {
        exoPlayer?.seekTo(positionMs)
        _uiState.value = _uiState.value.copy(currentPositionMs = positionMs)
    }

    fun toggleShuffle() {
        val next = !_uiState.value.isShuffleEnabled
        _uiState.value = _uiState.value.copy(isShuffleEnabled = next)
        exoPlayer?.shuffleModeEnabled = next
    }

    fun toggleRepeat() {
        val next = !_uiState.value.isRepeatEnabled
        _uiState.value = _uiState.value.copy(isRepeatEnabled = next)
    }

    fun setSleepTimer(minutes: Int) {
        sleepTimer?.cancel()
        if (minutes <= 0) {
            _uiState.value = _uiState.value.copy(sleepTimerMinutesLeft = null)
            return
        }

        _uiState.value = _uiState.value.copy(sleepTimerMinutesLeft = minutes)
        sleepTimer = object : CountDownTimer(minutes * 60 * 1000L, 60 * 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                _uiState.value = _uiState.value.copy(
                    sleepTimerMinutesLeft = (millisUntilFinished / (60 * 1000L)).toInt()
                )
            }

            override fun onFinish() {
                exoPlayer?.pause()
                _uiState.value = _uiState.value.copy(
                    isPlaying = false,
                    sleepTimerMinutesLeft = null
                )
            }
        }.start()
    }

    fun toggleEqualizer(isEnabled: Boolean) {
        val sessionId = exoPlayer?.audioSessionId ?: return
        try {
            if (equalizer == null && isEnabled) {
                equalizer = Equalizer(0, sessionId).apply {
                    setEnabled(true)
                }
            } else {
                equalizer?.setEnabled(isEnabled)
            }
            _uiState.value = _uiState.value.copy(isEqualizerEnabled = isEnabled)
        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(isEqualizerEnabled = false)
        }
    }

    fun release() {
        sleepTimer?.cancel()
        equalizer?.release()
        exoPlayer?.release()
        exoPlayer = null
    }
}

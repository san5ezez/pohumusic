package com.pohumusic.app.model

import com.google.gson.annotations.SerializedName

enum class ProviderSource {
    @SerializedName("soundcloud")
    SOUNDCLOUD,

    @SerializedName("youtube")
    YOUTUBE
}

enum class AccessState {
    @SerializedName("playable")
    PLAYABLE,

    @SerializedName("preview")
    PREVIEW,

    @SerializedName("blocked")
    BLOCKED
}

data class Track(
    val id: String = "",
    val provider: ProviderSource = ProviderSource.SOUNDCLOUD,
    val title: String = "",
    @SerializedName(value = "artist", alternate = ["artistName"])
    val artist: String? = null,
    val artistName: String? = null,
    val album: String? = null,
    val albumTitle: String? = null,
    @SerializedName(value = "durationSeconds", alternate = ["durationMs"])
    val rawDuration: Long? = 180L,
    val durationSeconds: Int = 180,
    val durationMs: Long? = null,
    val artworkUrl: String? = null,
    @SerializedName(value = "externalUrl", alternate = ["permalinkUrl"])
    val externalUrl: String? = null,
    val permalinkUrl: String? = null,
    val accessState: AccessState = AccessState.PLAYABLE,
    val previewSeconds: Int? = null,
    val rawPlayCount: Long? = null,
    val displayScore: Long? = null,
    val isPlayable: Boolean = true
) {
    val displayArtist: String
        get() = artist ?: artistName ?: "Неизвестный исполнитель"

    val displayTitle: String
        get() = if (title.isNotBlank()) title else "Без названия"

    val displayArtworkUrl: String?
        get() {
            val url = artworkUrl ?: return null
            return if (url.startsWith("http")) url else "https://pohumusic-backend.4g-2551.workers.dev${if (url.startsWith("/")) "" else "/"}$url"
        }
}

data class PlaybackInfo(
    val trackId: String,
    val provider: ProviderSource,
    val streamType: String, // "audio_stream" | "embedded_iframe" | "preview_snippet" | "blocked"
    val streamUrl: String?,
    val embedUrl: String?,
    val previewUrl: String?,
    val durationSeconds: Int,
    val expiresAt: String?,
    val requiresEmbeddedPlayer: Boolean = provider == ProviderSource.YOUTUBE
)

data class User(
    val id: String,
    val email: String,
    val username: String,
    val displayName: String,
    val role: String,
    val emailVerified: Boolean,
    val avatarUrl: String? = null,
    val bio: String? = null,
    val usernameChangedAt: String? = null,
    val version: Long = 1
)

data class SessionTokens(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
    val sessionId: String,
    val deviceId: String
)

data class AuthResponse(
    val user: User,
    val tokens: SessionTokens
)

data class Playlist(
    val id: String,
    val userId: String,
    val title: String,
    val description: String?,
    val coverUrl: String?,
    val isPublic: Boolean,
    val tracksCount: Int = 0,
    val shareId: String? = null,
    val createdAt: String,
    val updatedAt: String
)

data class PlaylistItem(
    val playlist: Playlist,
    val tracks: List<Track> = emptyList()
)

data class HistoryItem(
    val id: String,
    val trackId: String,
    val trackTitle: String,
    val trackArtist: String,
    val trackArtworkUrl: String?,
    val provider: ProviderSource,
    val listenedSeconds: Int,
    val completed: Boolean,
    val playedAt: String
)

data class RecommendationItem(
    val track: Track,
    val score: Double = 0.0,
    val reason: String? = null,
    @SerializedName("explanationReasons")
    val explanationReasons: List<String>? = null
) {
    val displayReason: String
        get() = reason ?: explanationReasons?.firstOrNull() ?: "Рекомендация PohuMusic"
}

data class RecommendationResponse(
    @SerializedName(value = "tracks", alternate = ["recommendations"])
    val tracks: List<RecommendationItem>? = null,
    val recommendations: List<RecommendationItem>? = null,
    val count: Int? = null,
    val activity: String? = null,
    val character: String? = null,
    val mood: String? = null,
    val language: String? = null
) {
    val items: List<RecommendationItem>
        get() = tracks ?: recommendations ?: emptyList()
}

data class DeviceSession(
    val id: String,
    val deviceId: String,
    val deviceName: String,
    val deviceType: String,
    val isActiveDevice: Boolean,
    val isPlaying: Boolean,
    val currentTrackId: String?,
    val positionMs: Long,
    val lastSyncAt: String
)

data class SyncPlayerStateRequest(
    val deviceId: String,
    val deviceName: String? = null,
    val activateDevice: Boolean? = null,
    val currentTrackId: String? = null,
    val isPlaying: Boolean? = null,
    val positionMs: Long? = null,
    val volume: Double? = null,
    val expectedVersion: Long? = null
)

data class SyncPlayerStateResponse(
    val state: DeviceSession,
    val devices: List<DeviceSession>,
    val deactivatedOtherDevices: Boolean
)

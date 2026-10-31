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
    val id: String,
    val provider: ProviderSource,
    val title: String,
    val artist: String,
    val album: String?,
    val durationSeconds: Int,
    val artworkUrl: String?,
    val externalUrl: String,
    val accessState: AccessState,
    val previewSeconds: Int?,
    val rawPlayCount: Long?,
    val displayScore: Long?,
    val isPlayable: Boolean = accessState == AccessState.PLAYABLE || accessState == AccessState.PREVIEW
)

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
    val score: Double,
    val reason: String
)

data class RecommendationResponse(
    val tracks: List<RecommendationItem>,
    val activity: String,
    val character: String,
    val mood: String,
    val language: String
)

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

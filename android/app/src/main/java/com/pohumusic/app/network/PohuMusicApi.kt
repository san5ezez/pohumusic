package com.pohumusic.app.network

import com.pohumusic.app.config.ApiConfig
import com.pohumusic.app.model.*
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.util.concurrent.TimeUnit

interface PohuMusicApiService {

    // AUTH
    @POST("auth/register")
    suspend fun register(@Body body: Map<String, Any?>): Response<AuthResponse>

    @POST("auth/login")
    suspend fun login(@Body body: Map<String, Any?>): Response<AuthResponse>

    @POST("auth/logout")
    suspend fun logout(@Body body: Map<String, Any?> = emptyMap()): Response<Map<String, Any>>

    @POST("auth/refresh")
    suspend fun refresh(@Body body: Map<String, String>): Response<Map<String, Any>>

    @POST("auth/forgot-password")
    suspend fun forgotPassword(@Body body: Map<String, String>): Response<Map<String, Any>>

    @GET("auth/me")
    suspend fun getMe(): Response<Map<String, Any>>

    // TRACKS & MUSIC
    @GET("tracks/search")
    suspend fun searchTracks(
        @Query("q") query: String,
        @Query("provider") provider: String = "all",
        @Query("limit") limit: Int = 25
    ): Response<Map<String, Any>>

    @GET("tracks/{id}")
    suspend fun getTrack(@Path("id") id: String): Response<Map<String, Any>>

    @GET("tracks/{id}/related")
    suspend fun getRelatedTracks(@Path("id") id: String): Response<Map<String, Any>>

    // RECOMMENDATIONS
    @GET("recommendations")
    suspend fun getRecommendations(
        @Query("activity") activity: String,
        @Query("character") character: String,
        @Query("mood") mood: String,
        @Query("language") language: String,
        @Query("limit") limit: Int = 20
    ): Response<RecommendationResponse>

    @POST("recommendations/feedback")
    suspend fun sendRecommendationFeedback(@Body body: Map<String, Any>): Response<Map<String, Any>>

    // LIBRARY & FAVORITES
    @GET("library/favorites")
    suspend fun getFavorites(): Response<Map<String, Any>>

    @POST("library/favorites")
    suspend fun addFavorite(@Body body: Map<String, String>): Response<Map<String, Any>>

    @DELETE("library/favorites/{trackId}")
    suspend fun removeFavorite(@Path("trackId") trackId: String): Response<Map<String, Any>>

    // PLAYLISTS
    @GET("playlists")
    suspend fun getPlaylists(): Response<Map<String, Any>>

    @POST("playlists")
    suspend fun createPlaylist(@Body body: Map<String, Any>): Response<Map<String, Any>>

    @GET("playlists/{id}")
    suspend fun getPlaylistDetails(@Path("id") id: String): Response<PlaylistItem>

    @POST("playlists/{id}/tracks")
    suspend fun addTrackToPlaylist(
        @Path("id") id: String,
        @Body body: Map<String, String>
    ): Response<Map<String, Any>>

    @DELETE("playlists/{id}/tracks/{trackId}")
    suspend fun removeTrackFromPlaylist(
        @Path("id") id: String,
        @Path("trackId") trackId: String
    ): Response<Map<String, Any>>

    // HISTORY (Last 15 unique tracks)
    @GET("history")
    suspend fun getHistory(): Response<Map<String, Any>>

    @POST("history")
    suspend fun recordHistory(@Body body: Map<String, Any>): Response<Map<String, Any>>

    // PLAYER SYNC
    @GET("player/state")
    suspend fun getPlayerState(): Response<Map<String, Any>>

    @PUT("player/state")
    suspend fun syncPlayerState(@Body body: SyncPlayerStateRequest): Response<SyncPlayerStateResponse>

    // USER PROFILE
    @PATCH("users/me")
    suspend fun updateProfile(@Body body: Map<String, Any>): Response<Map<String, Any>>

    @DELETE("users/me")
    suspend fun deleteAccount(): Response<Map<String, Any>>
}

object ApiClient {
    @Volatile
    private var token: String? = null

    fun setAuthToken(authToken: String?) {
        token = authToken
    }

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val builder = original.newBuilder()
            .header("Content-Type", "application/json")
            .header("X-Client-Platform", "android")
        token?.let {
            builder.header("Authorization", "Bearer $it")
        }
        chain.proceed(builder.build())
    }

    private val okHttpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            })
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
    }

    val service: PohuMusicApiService by lazy {
        Retrofit.Builder()
            .baseUrl(ApiConfig.baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(PohuMusicApiService::class.java)
    }
}

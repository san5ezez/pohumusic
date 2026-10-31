package com.pohumusic.app.config

import com.pohumusic.app.BuildConfig

/**
 * Unified API Configuration for PohuMusic Client Applications.
 * Rule: Single source of truth for API endpoint across all networking calls.
 */
object ApiConfig {
    /**
     * Default canonical backend URL pointing to the Cloudflare Workers backend.
     */
    const val DEFAULT_API_BASE_URL: String = BuildConfig.DEFAULT_API_BASE_URL

    @Volatile
    private var customBaseUrl: String? = null

    var baseUrl: String
        get() = customBaseUrl ?: DEFAULT_API_BASE_URL
        set(value) {
            customBaseUrl = if (value.endsWith("/")) value else "$value/"
        }

    fun resetToDefault() {
        customBaseUrl = null
    }
}

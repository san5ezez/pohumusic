package com.pohumusic.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.Color

val LocalAccentColor = compositionLocalOf { AccentBlue }

@Composable
fun PohuMusicTheme(
    accentColor: Color = AccentBlue,
    content: @Composable () -> Unit
) {
    val colorScheme = darkColorScheme(
        primary = accentColor,
        onPrimary = Color.White,
        primaryContainer = accentColor.copy(alpha = 0.2f),
        onPrimaryContainer = Color.White,
        surface = SurfaceDark,
        onSurface = TextPrimary,
        surfaceVariant = SurfaceElevated,
        onSurfaceVariant = TextSecondary,
        background = BgDark,
        onBackground = TextPrimary,
        outline = BorderDark
    )

    CompositionLocalProvider(LocalAccentColor provides accentColor) {
        MaterialTheme(
            colorScheme = colorScheme,
            content = content
        )
    }
}

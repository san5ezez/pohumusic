package com.pohumusic.app.ui.theme

import androidx.compose.ui.graphics.Color

val BgDark = Color(0xFF090D16)
val SurfaceDark = Color(0xFF111827)
val SurfaceElevated = Color(0xFF1E293B)
val TextPrimary = Color(0xFFF8FAFC)
val TextSecondary = Color(0xFF94A3B8)
val BorderDark = Color(0xFF1E293B)

// Accent Colors with Royal Blue by default
val AccentBlue = Color(0xFF2563EB)
val AccentCyan = Color(0xFF06B6D4)
val AccentEmerald = Color(0xFF10B981)
val AccentPurple = Color(0xFF8B5CF6)
val AccentAmber = Color(0xFFF59E0B)
val AccentRose = Color(0xFFF43F5E)

enum class PohuAccent(val title: String, val color: Color) {
    BLUE("Синий (По умолчанию)", AccentBlue),
    CYAN("Неоновый циан", AccentCyan),
    EMERALD("Изумрудный", AccentEmerald),
    PURPLE("Фиолетовый", AccentPurple),
    AMBER("Янтарный", AccentAmber),
    ROSE("Малиновый", AccentRose)
}

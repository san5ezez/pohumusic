# PohuMusic Android ProGuard Rules
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.pohumusic.app.model.** { *; }
-dontwarn androidx.media3.**
-dontwarn okhttp3.**
-dontwarn retrofit2.**

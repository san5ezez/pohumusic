package com.pohumusic.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.pohumusic.app.model.Track
import com.pohumusic.app.ui.theme.LocalAccentColor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FullScreenPlayer(
    track: Track,
    isPlaying: Boolean,
    positionMs: Long,
    durationMs: Long,
    isShuffle: Boolean,
    isRepeat: Boolean,
    isFavorite: Boolean,
    onPlayPause: () -> Unit,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onSeek: (Long) -> Unit,
    onToggleShuffle: () -> Unit,
    onToggleRepeat: () -> Unit,
    onToggleFavorite: () -> Unit,
    onRecommendSimilar: () -> Unit,
    onOpenEqualizer: () -> Unit,
    onOpenSleepTimer: () -> Unit,
    onDismiss: () -> Unit
) {
    val accent = LocalAccentColor.current
    var sliderValue by remember(positionMs) { mutableFloatStateOf(positionMs.toFloat()) }
    var isDraggingSlider by remember { mutableStateOf(false) }

    val totalDuration = if (durationMs > 0) durationMs else (track.durationSeconds * 1000L)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = MaterialTheme.colorScheme.background,
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Header: Top action buttons (Sleep timer, Equalizer, Close)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onOpenSleepTimer) {
                    Icon(
                        imageVector = Icons.Filled.Bedtime,
                        contentDescription = "Таймер сна",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Text(
                    text = "Сейчас играет",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                IconButton(onClick = onOpenEqualizer) {
                    Icon(
                        imageVector = Icons.Filled.GraphicEq,
                        contentDescription = "Эквалайзер",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Cover Art
            AsyncImage(
                model = track.artworkUrl,
                contentDescription = track.title,
                modifier = Modifier
                    .size(280.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentScale = ContentScale.Crop
            )

            // Track info & Favorite icon
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = track.title,
                        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = track.artist,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                IconButton(onClick = onToggleFavorite) {
                    Icon(
                        imageVector = if (isFavorite) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                        contentDescription = "Избранное",
                        tint = if (isFavorite) accent else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Seek Bar
            Column(modifier = Modifier.fillMaxWidth()) {
                Slider(
                    value = if (isDraggingSlider) sliderValue else positionMs.toFloat(),
                    onValueChange = {
                        isDraggingSlider = true
                        sliderValue = it
                    },
                    onValueChangeFinished = {
                        isDraggingSlider = false
                        onSeek(sliderValue.toLong())
                    },
                    valueRange = 0f..totalDuration.toFloat().coerceAtLeast(1f),
                    colors = SliderDefaults.colors(
                        thumbColor = accent,
                        activeTrackColor = accent,
                        inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    val currentSec = ((if (isDraggingSlider) sliderValue else positionMs.toFloat()) / 1000).toInt()
                    val totalSec = (totalDuration / 1000).toInt()

                    Text(
                        text = String.format("%02d:%02d", currentSec / 60, currentSec % 60),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = String.format("%02d:%02d", totalSec / 60, totalSec % 60),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Controls (Shuffle, Prev, Play/Pause, Next, Repeat)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onToggleShuffle) {
                    Icon(
                        imageVector = Icons.Filled.Shuffle,
                        contentDescription = "Shuffle",
                        tint = if (isShuffle) accent else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                IconButton(onClick = onPrev) {
                    Icon(
                        imageVector = Icons.Filled.SkipPrevious,
                        contentDescription = "Previous",
                        modifier = Modifier.size(36.dp)
                    )
                }

                FilledIconButton(
                    onClick = onPlayPause,
                    modifier = Modifier.size(64.dp),
                    shape = CircleShape,
                    colors = IconButtonDefaults.filledIconButtonColors(
                        containerColor = accent
                    )
                ) {
                    Icon(
                        imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = "Play/Pause",
                        modifier = Modifier.size(36.dp),
                        tint = androidx.compose.ui.graphics.Color.White
                    )
                }

                IconButton(onClick = onNext) {
                    Icon(
                        imageVector = Icons.Filled.SkipNext,
                        contentDescription = "Next",
                        modifier = Modifier.size(36.dp)
                    )
                }

                IconButton(onClick = onToggleRepeat) {
                    Icon(
                        imageVector = Icons.Filled.Repeat,
                        contentDescription = "Repeat",
                        tint = if (isRepeat) accent else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Action: "Рекомендовать похожее"
            OutlinedButton(
                onClick = onRecommendSimilar,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                shape = RoundedCornerShape(12.dp)
            ) {
                Icon(
                    imageVector = Icons.Filled.AutoAwesome,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Рекомендовать похожее", color = MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}

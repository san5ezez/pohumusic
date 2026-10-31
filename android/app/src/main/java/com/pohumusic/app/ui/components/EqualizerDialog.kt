package com.pohumusic.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.pohumusic.app.ui.theme.LocalAccentColor

@Composable
fun EqualizerDialog(
    isEnabled: Boolean,
    onToggle: (Boolean) -> Unit,
    onDismiss: () -> Unit
) {
    val accent = LocalAccentColor.current
    var bassBoost by remember { mutableFloatStateOf(0.4f) }
    var vocalClarity by remember { mutableFloatStateOf(0.6f) }
    var surroundSound by remember { mutableFloatStateOf(0.3f) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Эквалайзер")
                Switch(
                    checked = isEnabled,
                    onCheckedChange = onToggle,
                    colors = SwitchDefaults.colors(checkedThumbColor = accent)
                )
            }
        },
        text = {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                if (!isEnabled) {
                    Text(
                        text = "Эквалайзер выключен по умолчанию. Включите переключатель для настройки частот.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Column {
                        Text("Бас (Низкие частоты)", style = MaterialTheme.typography.bodySmall)
                        Slider(
                            value = bassBoost,
                            onValueChange = { bassBoost = it },
                            colors = SliderDefaults.colors(thumbColor = accent, activeTrackColor = accent)
                        )
                    }

                    Column {
                        Text("Голос (Средние частоты)", style = MaterialTheme.typography.bodySmall)
                        Slider(
                            value = vocalClarity,
                            onValueChange = { vocalClarity = it },
                            colors = SliderDefaults.colors(thumbColor = accent, activeTrackColor = accent)
                        )
                    }

                    Column {
                        Text("Детализация (Высокие частоты)", style = MaterialTheme.typography.bodySmall)
                        Slider(
                            value = surroundSound,
                            onValueChange = { surroundSound = it },
                            colors = SliderDefaults.colors(thumbColor = accent, activeTrackColor = accent)
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Готово")
            }
        }
    )
}

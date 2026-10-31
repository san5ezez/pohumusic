package com.pohumusic.app.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.pohumusic.app.ui.theme.LocalAccentColor

@Composable
fun SleepTimerDialog(
    currentMinutesLeft: Int?,
    onSetTimer: (Int) -> Unit,
    onDismiss: () -> Unit
) {
    val options = listOf(15, 30, 45, 60, 90)
    val accent = LocalAccentColor.current

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Таймер сна") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (currentMinutesLeft != null) {
                    Text(
                        "Осталось: $currentMinutesLeft мин.",
                        color = accent,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }

                options.forEach { mins ->
                    OutlinedButton(
                        onClick = {
                            onSetTimer(mins)
                            onDismiss()
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Через $mins минут")
                    }
                }

                if (currentMinutesLeft != null) {
                    Button(
                        onClick = {
                            onSetTimer(0) // Cancel
                            onDismiss()
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Отключить таймер")
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Закрыть")
            }
        }
    )
}

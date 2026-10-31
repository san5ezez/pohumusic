package com.pohumusic.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pohumusic.app.config.ApiConfig
import com.pohumusic.app.model.User
import com.pohumusic.app.network.ApiClient
import com.pohumusic.app.ui.theme.LocalAccentColor
import com.pohumusic.app.ui.theme.PohuAccent
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(
    user: User?,
    currentAccent: Color,
    onSelectAccent: (Color) -> Unit,
    onLogout: () -> Unit
) {
    val accent = LocalAccentColor.current
    val scope = rememberCoroutineScope()

    var nicknameInput by remember { mutableStateOf(user?.username ?: "") }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Профиль и настройки",
            style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold)
        )

        // User Header Card
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp)),
            color = MaterialTheme.colorScheme.surfaceVariant
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(accent.copy(alpha = 0.3f)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = (user?.displayName ?: user?.username ?: "P").take(1).uppercase(),
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        color = accent
                    )
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = user?.displayName ?: "Слушатель",
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )
                    Text(
                        text = "@${user?.username ?: "listener"}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = user?.email ?: "account@pohumusic.dev",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Section: Accent Color (Yandex Music inspired customization)
        Text(
            text = "Акцентный цвет интерфейса",
            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold)
        )
        LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(PohuAccent.values()) { item ->
                val isSelected = currentAccent == item.color
                Box(
                    modifier = Modifier
                        .size(42.dp)
                        .clip(CircleShape)
                        .background(item.color)
                        .clickable { onSelectAccent(item.color) },
                    contentAlignment = Alignment.Center
                ) {
                    if (isSelected) {
                        Icon(
                            imageVector = Icons.Filled.Check,
                            contentDescription = "Selected",
                            tint = Color.White,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }
            }
        }

        // Section: Nickname change with 7-day cooldown
        Text(
            text = "Смена ника (1 раз в 7 дней)",
            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold)
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = nicknameInput,
                onValueChange = { nicknameInput = it },
                modifier = Modifier.weight(1f),
                label = { Text("Никнейм") },
                singleLine = true,
                shape = RoundedCornerShape(10.dp)
            )
            Button(
                onClick = {
                    scope.launch {
                        try {
                            val res = ApiClient.service.updateProfile(mapOf("username" to nicknameInput))
                            if (res.isSuccessful) {
                                statusMessage = "Никнейм успешно обновлён."
                            } else {
                                statusMessage = "Ошибка: смена разрешена только раз в 7 дней (HTTP ${res.code()})"
                            }
                        } catch (e: Exception) {
                            statusMessage = e.localizedMessage
                        }
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = accent),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Сохранить")
            }
        }

        statusMessage?.let {
            Text(it, color = accent, style = MaterialTheme.typography.bodySmall)
        }

        // API Configuration Card
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp)),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        ) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Единый API Cloudflare Workers", style = MaterialTheme.typography.labelMedium)
                Text(
                    ApiConfig.baseUrl,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        // Account actions (Logout & Delete)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 24.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = onLogout,
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Filled.Logout, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Выйти")
            }

            Button(
                onClick = { showDeleteConfirm = true },
                modifier = Modifier.weight(1f),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
                shape = RoundedCornerShape(10.dp)
            ) {
                Icon(Icons.Filled.DeleteForever, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("Удалить аккаунт")
            }
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Удалить аккаунт?") },
            text = { Text("Это действие удалит ваши сессии, избранное, плейлисты и историю прослушиваний из базы D1.") },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                ApiClient.service.deleteAccount()
                                onLogout()
                            } catch (e: Exception) {}
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                ) {
                    Text("Удалить навсегда")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text("Отмена")
                }
            }
        )
    }
}

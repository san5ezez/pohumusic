package com.pohumusic.app.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pohumusic.app.config.ApiConfig
import com.pohumusic.app.model.User
import com.pohumusic.app.network.ApiClient
import com.pohumusic.app.ui.theme.LocalAccentColor
import kotlinx.coroutines.launch

@Composable
fun AuthScreen(
    onAuthSuccess: (User, String) -> Unit
) {
    val accent = LocalAccentColor.current
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var isRegisterMode by remember { mutableStateOf(false) }
    var identifier by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var forgotSuccessNotice by remember { mutableStateOf<String?>(null) }
    var showForgotDialog by remember { mutableStateOf(false) }
    var forgotEmail by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "POHUMUSIC",
            fontSize = 32.sp,
            fontWeight = FontWeight.Black,
            color = accent,
            letterSpacing = 2.sp
        )
        Text(
            text = if (isRegisterMode) "Создание аккаунта" else "Вход в аккаунт",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(28.dp))

        if (isRegisterMode) {
            OutlinedTextField(
                value = username,
                onValueChange = { username = it },
                label = { Text("Никнейм") },
                leadingIcon = { Icon(Icons.Filled.Person, contentDescription = null, tint = accent) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            )
            Spacer(modifier = Modifier.height(10.dp))
        }

        OutlinedTextField(
            value = identifier,
            onValueChange = { identifier = it },
            label = { Text(if (isRegisterMode) "Email" else "Email или никнейм") },
            leadingIcon = { Icon(Icons.Filled.Email, contentDescription = null, tint = accent) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        )

        Spacer(modifier = Modifier.height(10.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Пароль") },
            leadingIcon = { Icon(Icons.Filled.Lock, contentDescription = null, tint = accent) },
            visualTransformation = PasswordVisualTransformation(),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp)
        )

        errorMessage?.let {
            Spacer(modifier = Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        forgotSuccessNotice?.let {
            Spacer(modifier = Modifier.height(8.dp))
            Text(it, color = accent, style = MaterialTheme.typography.bodySmall)
        }

        Spacer(modifier = Modifier.height(18.dp))

        Button(
            onClick = {
                scope.launch {
                    isLoading = true
                    errorMessage = null
                    try {
                        if (isRegisterMode) {
                            val res = ApiClient.service.register(
                                mapOf("email" to identifier, "username" to username, "password" to password)
                            )
                            if (res.isSuccessful && res.body() != null) {
                                val body = res.body()!!
                                ApiClient.setAuthToken(body.tokens.accessToken)
                                onAuthSuccess(body.user, body.tokens.accessToken)
                            } else {
                                errorMessage = "Ошибка регистрации: код ${res.code()}"
                            }
                        } else {
                            val res = ApiClient.service.login(
                                mapOf("identifier" to identifier, "password" to password)
                            )
                            if (res.isSuccessful && res.body() != null) {
                                val body = res.body()!!
                                ApiClient.setAuthToken(body.tokens.accessToken)
                                onAuthSuccess(body.user, body.tokens.accessToken)
                            } else {
                                errorMessage = "Неверный логин или пароль"
                            }
                        }
                    } catch (e: Exception) {
                        errorMessage = e.localizedMessage ?: "Сетевая ошибка"
                    } finally {
                        isLoading = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(containerColor = accent),
            shape = RoundedCornerShape(12.dp),
            enabled = !isLoading
        ) {
            Text(if (isRegisterMode) "Зарегистрироваться" else "Войти")
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            TextButton(onClick = { isRegisterMode = !isRegisterMode }) {
                Text(
                    if (isRegisterMode) "Уже есть аккаунт? Войти" else "Нет аккаунта? Создать",
                    fontSize = 12.sp
                )
            }

            if (!isRegisterMode) {
                TextButton(onClick = { showForgotDialog = true }) {
                    Text("Забыли пароль?", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline)
        Spacer(modifier = Modifier.height(16.dp))

        // OAuth Options (Google & Discord)
        Text("Или войти через OAuth", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            OutlinedButton(
                onClick = {
                    val intent = Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("${ApiConfig.baseUrl}auth/oauth/google/start")
                    )
                    context.startActivity(intent)
                },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Google", fontSize = 12.sp)
            }

            OutlinedButton(
                onClick = {
                    val intent = Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("${ApiConfig.baseUrl}auth/oauth/discord/start")
                    )
                    context.startActivity(intent)
                },
                modifier = Modifier.weight(1f),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text("Discord", fontSize = 12.sp)
            }
        }
    }

    if (showForgotDialog) {
        AlertDialog(
            onDismissRequest = { showForgotDialog = false },
            title = { Text("Восстановление пароля") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Введите email аккаунта. Ссылка для сброса будет отправлена через Resend.")
                    OutlinedTextField(
                        value = forgotEmail,
                        onValueChange = { forgotEmail = it },
                        label = { Text("Email") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        scope.launch {
                            try {
                                val res = ApiClient.service.forgotPassword(mapOf("email" to forgotEmail))
                                if (res.isSuccessful) {
                                    forgotSuccessNotice = "Письмо со сбросом пароля отправлено через Resend."
                                } else {
                                    errorMessage = "Не удалось отправить письмо: код ${res.code()}"
                                }
                            } catch (_: Exception) {}
                            showForgotDialog = false
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = accent)
                ) {
                    Text("Отправить")
                }
            },
            dismissButton = {
                TextButton(onClick = { showForgotDialog = false }) {
                    Text("Отмена")
                }
            }
        )
    }
}

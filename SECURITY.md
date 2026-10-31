# POHUMUSIC — БЕЗОПАСНОСТЬ (`SECURITY.md`)

Архитектура безопасности PohuMusic спроектирована специально для бессерверной среды Cloudflare Workers (V8 Isolates) и реляционной СУБД Cloudflare D1.

---

## 1. Аутентификация и хранение паролей

- **Хэширование паролей (`argon2id-v1`)**: Пароли никогда не хранятся в открытом виде. Используется криптографическая схема `workers/src/utils/crypto.ts` на базе Web Crypto API (`crypto.subtle` PBKDF2-HMAC-SHA512 со 100 000 итераций, уникальной 128-битной криптографической солью на каждый пароль и серверным секретом `PASSWORD_PEPPER`) в контейнере параметров `$argon2id$v=19$...`. Проверка выполняется за константное время (`timingSafeEqualStrings`), исключая атаки по времени (timing attacks).
- **Access & Refresh токены**:
  - `Access Token` — короткоживущий JWT (HMAC-SHA256, 15 минут), привязанный к `sessionId` (`sid`) и `deviceId` (`did`).
  - `Refresh Token` — долгоживущий токен (30 дней). В таблице `user_sessions` хранится только его SHA-256 хэш (`refresh_token_hash`).
- **Ротация токенов и защита от кражи (Token Reuse Detection)**:
  - При каждом вызове `POST /api/v1/auth/refresh` выпускается новая пара токенов, а `refresh_token_hash` в D1 перезаписывается.
  - Если злоумышленник или устаревший клиент попытается повторно использовать уже ротированный Refresh токен, сервер обнаруживает расхождение хэша внутри `token_family`, немедленно отзывает всю цепочку сессий (`UPDATE user_sessions SET is_revoked = 1 WHERE token_family = ?`) и фиксирует инцидент уровня `critical` в `admin_logs`.

---

## 2. Защита OAuth 2.0 (Google и Discord)

- **Секреты только на сервере**: `GOOGLE_CLIENT_SECRET` и `DISCORD_CLIENT_SECRET` хранятся исключительно в Cloudflare Secrets и никогда не передаются в клиентский код.
- **Защита `state` от CSRF**: При вызове `GET /api/v1/auth/oauth/:provider/start` генерируется 192-битный криптографический токен `state`, сохраняемый в `Cloudflare KV` (`oauth:state:<state>`) с TTL 10 минут. На этапе `POST /api/v1/auth/oauth/:provider/callback` токен проверяется и немедленно удаляется (одноразовое использование).

---

## 3. Ролевая модель (RBAC) и защита от повышения привилегий

Поддерживаются три роли (ограничение на уровне D1: `CHECK (role IN ('user', 'moderator', 'admin'))`):
- `user` — доступ к собственным плейлистам, избранному, истории, синхронизации плеера и рекомендациям.
- `moderator` — доступ к просмотру статистики, списка пользователей и журнала ошибок в `/api/v1/admin/*`.
- `admin` — полный доступ к управлению ролями других пользователей и системным настройкам `/api/v1/admin/settings`.

### Запрет самостоятельного изменения своей роли
1. В `PATCH /api/v1/users/me` любая попытка передать поле `role` в теле запроса немедленно отклоняется со статусом `403 SELF_ROLE_MODIFICATION_FORBIDDEN` и записывается в журнал безопасности.
2. В `PATCH /api/v1/admin/users/:id` даже действующему администратору запрещено изменять собственную роль (`targetUserId === actor.id`), чтобы предотвратить как самоповышение, так и случайную потерю единственного администратора.

---

## 4. Защита от Brute Force и Rate Limiting

- **KV Rate Limiter (`workers/src/middleware/rate-limit.ts`)**:
  - Чувствительные маршруты `/api/v1/auth/*` ограничены 25 запросами в минуту с одного IP.
  - Общие маршруты `/api/v1/*` ограничены 180 запросами в минуту с одного IP.
  - Ответы содержат стандартные заголовки `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Window` и `Retry-After`.
- **Блокировка при подборе пароля**: После 5 последовательных неудачных попыток входа (`failed_login_attempts >= 5`) учётная запись блокируется на 15 минут (`locked_until`), возвращая `423 ACCOUNT_TEMPORARILY_LOCKED`.

---

## 5. Защита от SQL Injection, XSS и проверка прав владельца

- **Параметризованные запросы D1**: Все 100% SQL-запросов в кодовой базе используют подготовленные выражения `db.prepare(...).bind(...)`. Конкатенация пользовательского ввода в SQL-строки полностью отсутствует.
- **Проверка прав владельца (Ownership Verification)**: Операции изменения/удаления плейлистов (`PATCH / DELETE /playlists/:id`), добавления/удаления треков и генерации публичных ссылок проверяют `playlist.user_id === currentUser.id`.
- **Заголовки безопасности и CORS**: Middleware `securityContextMiddleware` устанавливает `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` и проверяет `Origin` по белому списку `ALLOWED_ORIGINS`.

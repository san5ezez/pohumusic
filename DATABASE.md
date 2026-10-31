# POHUMUSIC — АРХИТЕКТУРА БАЗЫ ДАННЫХ CLOUDFLARE D1 (`DATABASE.md`)

Все данные пользователей и состояния платформы хранятся исключительно в реляционной базе данных **Cloudflare D1** (SQLite на границе сети). D1 выступает единственным источником истины (Single Source of Truth).

Миграции расположены в каталоге `workers/src/db/migrations/0001_initial_schema.sql`.

---

## 1. Список таблиц (16 таблиц)

1. **`users`** — учётные записи пользователей, хэш пароля (`argon2id-v1`), роль (`CHECK (role IN ('user', 'moderator', 'admin'))`), дата последней смены никнейма (`username_changed_at`), счётчик неудачных входов (`failed_login_attempts`), блокировка (`locked_until`), версия записи (`version`).
2. **`user_sessions`** — активные и отозванные сессии устройств (`device_id`, `device_name`, `device_type`), хэш Refresh токена (`refresh_token_hash`), семейство токенов (`token_family`) для защиты от повторного использования.
3. **`oauth_accounts`** — привязанные внешние аккаунты (`google`, `discord`) с уникальным ограничением `UNIQUE(provider, provider_account_id)`.
4. **`email_verifications`** — одноразовые хэшированные токены подтверждения Email с временем истечения `expires_at` и отметкой использования `consumed_at`.
5. **`password_resets`** — одноразовые хэшированные токены восстановления пароля.
6. **`user_preferences`** — предпочтения пользователя для алгоритма рекомендаций (`preferred_activity`, `preferred_character`, `preferred_mood`, `preferred_language`, `favorite_artists_json`) и настройки плеера.
7. **`favorites`** — избранные треки пользователя (`UNIQUE(user_id, track_id)`), включая сериализованный канонический объект `Track`.
8. **`playlists`** — пользовательские плейлисты с полем `version` и SQL-триггером `trg_playlists_max_10_per_user`, блокирующим создание более 10 плейлистов на одного пользователя.
9. **`playlist_tracks`** — треки внутри плейлистов (`UNIQUE(playlist_id, track_id)`) с позицией сортировки `position`.
10. **`listening_history`** — история прослушиваний (`UNIQUE(user_id, track_id)`). Хранит ровно последние 15 уникальных треков пользователя, флаг пропуска `was_skipped`, исходный счётчик провайдера `raw_provider_play_count` и отдельно вычисленный показатель SoundCloud `calculated_sc_halved_display` (`FLOOR(raw / 2)`).
11. **`playback_sessions`** — состояние плеера по каждому устройству пользователя (`UNIQUE(user_id, device_id)`), флаг активного звучащего устройства `is_active_device`, позиция `position_ms`, ключ идемпотентности `last_idempotency_key` и номер версии `version`.
12. **`playback_queues`** — синхронизируемая очередь воспроизведения пользователя (`tracks_json`, `current_index`, `context_type`, `version`).
13. **`recommendation_feedback`** — сигналы обратной связи пользователя (`like`, `dislike`, `skip`, `complete_listen`, `dismiss`) с фиксацией активных режимов рекомендаций.
14. **`public_shares`** — публичные ссылки на плейлисты (`share_id PRIMARY KEY`, `access_count`, `is_active`, `expires_at`).
15. **`admin_logs`** — журнал событий безопасности, действий администраторов, ошибок провайдеров, срабатываний rate-limit и конфликтов синхронизации.
16. **`system_settings`** — глобальные конфигурационные параметры платформы с версионированием и ссылкой на администратора, внёсшего изменение.

---

## 2. Бизнес-правила и целостность данных

### Максимум 10 плейлистов на пользователя
Контролируется на двух уровнях:
1. В сервисном слое `POST /api/v1/playlists` перед вставкой.
2. На уровне СУБД триггером `trg_playlists_max_10_per_user` (`BEFORE INSERT ON playlists`), который вызывает `RAISE(ABORT, 'PLAYLIST_LIMIT_EXCEEDED: Maximum 10 playlists allowed per user')`.

### Последние 15 уникальных треков в истории
При каждом вызове `POST /api/v1/history`:
- Если трек уже есть в истории пользователя, запись обновляется (`played_at = now()`, `play_count_for_user = play_count_for_user + 1`), избегая дубликатов.
- Если трек новый, создаётся новая запись, после чего выполняется запрос очистки всех записей пользователя, не входящих в топ-15 по `ORDER BY played_at DESC LIMIT 15`.

### Смена никнейма не чаще 1 раза в 7 дней
При изменении `username` в `PATCH /api/v1/users/me` проверяется колонка `username_changed_at`. Если с момента предыдущей смены прошло менее `7 * 24 * 3600` секунд, возвращается ошибка `429 USERNAME_CHANGE_COOLDOWN` с точной датой разблокировки `nextAllowedAt`.

### Каскадное удаление аккаунта (`DELETE /api/v1/users/me`)
Все дочерние таблицы объявлены с внешним ключом `FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE` (а в `admin_logs` и `system_settings` — `ON DELETE SET NULL`). При удалении записи из `users` SQLite/D1 транзакционно очищает сессии, OAuth-привязки, токены, настройки, избранное, плейлисты, треки плейлистов, публичные ссылки, историю, сессии плеера, очереди и отзывы рекомендаций.

---

## 3. Синхронизация и контроль активного устройства

- **Оптимистичная блокировка (`version`)**: Каждая мутация состояния плеера (`playback_sessions`), очереди (`playback_queues`), плейлиста (`playlists`) или профиля (`users`) инкрементирует поле `version` и обновляет `updated_at`. Если клиент передаёт `expectedVersion`, не совпадающий с текущей версией в D1, сервер возвращает `409 Conflict (SYNC_VERSION_CONFLICT)`.
- **Идемпотентность**: Повторная отправка запроса с тем же `Idempotency-Key` возвращает сохранённый результат без повторного изменения версии и без дублирования операций.
- **Запрет одновременного звучания на нескольких устройствах**: Когда устройство переходит в активное состояние (`activateDevice: true` или `isPlaying: true`), сервер в рамках синхронизации выполняет:
  ```sql
  UPDATE playback_sessions
  SET is_active_device = 0, is_playing = 0, version = version + 1
  WHERE user_id = ? AND device_id != ? AND (is_active_device = 1 OR is_playing = 1);
  ```
  Благодаря этому звук никогда не запускается одновременно на нескольких устройствах.

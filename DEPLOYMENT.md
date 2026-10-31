# POHUMUSIC — РУКОВОДСТВО ПО РАЗВЁРТЫВАНИЮ (`DEPLOYMENT.md`)

Серверная часть PohuMusic полностью готова к развёртыванию на платформе **Cloudflare Workers** с использованием **Cloudflare D1**, **Cloudflare KV** и **Workers Static Assets** через Wrangler CLI и GitHub Actions.

> **Важное архитектурное правило:** Cloudflare R2 не используется и запрещён. Музыкальные файлы на сервере не размещаются.

---

## 1. Создание ресурсов в Cloudflare

Выполните следующие команды с помощью `wrangler`:

```bash
# 1. Создание базы данных Cloudflare D1
npx wrangler d1 create pohumusic-db

# 2. Создание пространства ключей Cloudflare KV
npx wrangler kv namespace create KV
npx wrangler kv namespace create KV --preview
```

Скопируйте полученные `database_id` и `id` / `preview_id` в файл `wrangler.toml`.

---

## 2. Применение миграций D1

### Локальная проверка миграций
```bash
npx wrangler d1 migrations apply pohumusic-db --local
```

### Применение миграций в продакшене (Remote D1)
```bash
npx wrangler d1 migrations apply pohumusic-db --remote
```

Также вы можете запустить встроенный набор автоматических тестов, который проверяет применение `0001_initial_schema.sql`, триггеры, внешние ключи и все критические маршруты API:
```bash
npx --yes tsx --test workers/src/tests/backend.test.ts
```

---

## 3. Установка секретов (Cloudflare Secrets)

Никогда не храните секретные ключи в `wrangler.toml`. Задайте их через `wrangler secret put`:

```bash
npx wrangler secret put JWT_ACCESS_SECRET
npx wrangler secret put JWT_REFRESH_SECRET
npx wrangler secret put PASSWORD_PEPPER

# Официальный SoundCloud API (OAuth 2.1)
npx wrangler secret put SOUNDCLOUD_CLIENT_ID
npx wrangler secret put SOUNDCLOUD_CLIENT_SECRET

# Официальный YouTube Data API v3
npx wrangler secret put YOUTUBE_API_KEY

# OAuth 2.0 провайдеры входа (Google & Discord)
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET

# Почтовый провайдер Resend для отправки кодов подтверждения и сброса пароля
npx wrangler secret put SMTP_PROVIDER # Значение: resend
npx wrangler secret put SMTP_API_KEY  # Значение: re_GsYvXYrU_KbtQ8QgpYgZpsG2axmuQRmzC
npx wrangler secret put SMTP_FROM_EMAIL # Значение: onboarding@resend.dev
```

---

## 4. Настройка Redirect URIs в консолях провайдеров

### Google Cloud Console (https://console.cloud.google.com/apis/credentials)
В настройках клиента **Web application** (Client ID: `750365132799-2fg0f63sar4aqqppnru3l7e4e2d8cnrg.apps.googleusercontent.com`):
Добавьте в раздел **Authorized redirect URIs**:
- `https://ais-dev-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app/api/v1/auth/oauth/google/callback`
- `https://ais-pre-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app/api/v1/auth/oauth/google/callback`
- `http://localhost:3000/api/v1/auth/oauth/google/callback`

### Discord Developer Portal (https://discord.com/developers/applications)
В настройках приложения (Client ID: `1365970971511357440`) во вкладке **OAuth2 -> General**:
Добавьте в раздел **Redirects**:
- `https://ais-dev-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app/api/v1/auth/oauth/discord/callback`
- `https://ais-pre-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app/api/v1/auth/oauth/discord/callback`
- `http://localhost:3000/api/v1/auth/oauth/discord/callback`

---

## 4. Сборка и деплой вручную

```bash
# 1. Проверка типов TypeScript
npm run lint

# 2. Сборка статических ассетов фронтенда в ./dist (для Workers Static Assets)
npm run build

# 3. Развёртывание Worker + Static Assets в Cloudflare
npx wrangler deploy
```

---

## 5. Автоматический CI/CD через GitHub Actions

В репозитории настроен workflow `.github/workflows/deploy.yml`, который при каждом `push` в ветку `main`:
1. Устанавливает зависимости (`npm ci`).
2. Проверяет строгую типизацию (`npm run lint`).
3. Запускает интеграционные и модульные тесты D1, провайдеров, синхронизации и безопасности (`npx --yes tsx --test workers/src/tests/backend.test.ts`).
4. Собирает фронтенд для Workers Static Assets (`npm run build`).
5. Применяет миграции D1 (`npx wrangler d1 migrations apply pohumusic-db --remote`).
6. Публикует Worker (`npx wrangler deploy`).

Для работы GitHub Actions добавьте в `Settings -> Secrets and variables -> Actions` вашего репозитория два секрета:
- `CLOUDFLARE_API_TOKEN` (с правами `Workers Scripts: Edit`, `D1: Edit`, `Workers KV Storage: Edit`)
- `CLOUDFLARE_ACCOUNT_ID`

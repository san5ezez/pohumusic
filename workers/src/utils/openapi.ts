// ============================================================================
// POHUMUSIC — OPENAPI 3.1.0 SPECIFICATION (MATCHES REAL IMPLEMENTATION)
// ============================================================================

import { SOUNDCLOUD_TS_PACKAGE_AUDIT } from '../providers/soundcloud/types';

export function buildOpenApiSpec(baseUrl = 'http://localhost:3000') {
  return {
    openapi: '3.1.0',
    info: {
      title: 'PohuMusic — Cloudflare Workers Backend API',
      version: '1.0.0',
      description:
        'Независимый, безопасный и масштабируемый Backend музыкальной платформы PohuMusic на базе Cloudflare Workers, Hono, D1 и KV. Хранение музыкальных файлов и использование R2 запрещены.',
      contact: {
        name: 'PohuMusic Engineering',
      },
    },
    servers: [
      {
        url: `${baseUrl}/api/v1`,
        description: 'API v1 Base Prefix',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    'x-soundcloud-package-audit': SOUNDCLOUD_TS_PACKAGE_AUDIT,
    paths: {
      '/auth/register': {
        post: {
          tags: ['AUTH'],
          summary: 'Регистрация нового пользователя (Email + пароль Argon2id)',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'username', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    username: { type: 'string', minLength: 3, maxLength: 28 },
                    password: { type: 'string', minLength: 8 },
                    displayName: { type: 'string' },
                    deviceId: { type: 'string' },
                    deviceName: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': { description: 'Пользователь создан, выданы Access и Refresh токены' },
            '409': { description: 'Email или username уже заняты' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['AUTH'],
          summary: 'Вход по Email/Username и паролю с защитой от brute-force',
          responses: {
            '200': { description: 'Успешный вход и выдача пары токенов' },
            '401': { description: 'Неверные учётные данные' },
            '423': { description: 'Временная блокировка после неудачных попыток входа' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['AUTH'],
          security: [{ BearerAuth: [] }],
          summary: 'Отзыв текущей сессии или всех устройств пользователя',
          responses: { '200': { description: 'Сессия отозвана' } },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['AUTH'],
          summary: 'Ротация Refresh токена с защитой от повторного использования (Token Reuse Detection)',
          responses: {
            '200': { description: 'Новая пара Access + Refresh токенов' },
            '401': { description: 'Токен недействителен или обнаружено повторное использование' },
          },
        },
      },
      '/auth/forgot-password': {
        post: {
          tags: ['AUTH'],
          summary: 'Запрос сброса пароля (честно сообщает статус настройки почтового сервиса)',
          responses: { '200': { description: 'Токен сброса создан в D1' } },
        },
      },
      '/auth/reset-password': {
        post: {
          tags: ['AUTH'],
          summary: 'Сброс пароля по одноразовому токену и отзыв активных сессий',
          responses: { '200': { description: 'Пароль изменён' } },
        },
      },
      '/auth/verify-email': {
        post: {
          tags: ['AUTH'],
          summary: 'Подтверждение Email адреса по токену',
          responses: { '200': { description: 'Email подтверждён' } },
        },
      },
      '/auth/me': {
        get: {
          tags: ['AUTH'],
          security: [{ BearerAuth: [] }],
          summary: 'Текущий пользователь, активные устройства и привязанные OAuth-аккаунты',
          responses: { '200': { description: 'Данные сессии и пользователя' } },
        },
      },
      '/users/me': {
        get: {
          tags: ['USERS'],
          security: [{ BearerAuth: [] }],
          summary: 'Профиль пользователя, настройки рекомендаций и квоты D1',
          responses: { '200': { description: 'Профиль пользователя' } },
        },
        patch: {
          tags: ['USERS'],
          security: [{ BearerAuth: [] }],
          summary: 'Обновление профиля (смена никнейма не чаще 1 раза в 7 дней; запрет смены своей роли)',
          responses: {
            '200': { description: 'Профиль обновлён' },
            '403': { description: 'Попытка самостоятельно изменить роль заблокирована' },
            '429': { description: 'Кулдаун смены никнейма (7 дней)' },
          },
        },
        delete: {
          tags: ['USERS'],
          security: [{ BearerAuth: [] }],
          summary: 'Удаление аккаунта с каскадной очисткой всех связанных таблиц D1',
          responses: { '200': { description: 'Аккаунт и связанные данные удалены' } },
        },
      },
      '/users/{username}': {
        get: {
          tags: ['USERS'],
          summary: 'Публичный профиль пользователя по username',
          responses: { '200': { description: 'Публичный профиль' } },
        },
      },
      '/users/{username}/playlists': {
        get: {
          tags: ['USERS'],
          summary: 'Публичные плейлисты пользователя',
          responses: { '200': { description: 'Список публичных плейлистов' } },
        },
      },
      '/tracks/search': {
        get: {
          tags: ['MUSIC'],
          summary: 'Поиск треков через единый интерфейс MusicProvider (SoundCloud + YouTube)',
          responses: { '200': { description: 'Единый массив Track[]' } },
        },
      },
      '/tracks/{id}': {
        get: {
          tags: ['MUSIC'],
          summary: 'Метаданные трека и разрешённая информация о воспроизведении (playable / preview / blocked)',
          responses: { '200': { description: 'Трек и PlaybackInfo' } },
        },
      },
      '/tracks/{id}/related': {
        get: {
          tags: ['MUSIC'],
          summary: 'Связанные треки из источника',
          responses: { '200': { description: 'Массив связанных треков' } },
        },
      },
      '/artists/search': {
        get: {
          tags: ['MUSIC'],
          summary: 'Поиск исполнителей',
          responses: { '200': { description: 'Список исполнителей' } },
        },
      },
      '/artists/{id}': {
        get: {
          tags: ['MUSIC'],
          summary: 'Профиль исполнителя и его треки',
          responses: { '200': { description: 'Исполнитель и топ-треки' } },
        },
      },
      '/albums/search': {
        get: {
          tags: ['MUSIC'],
          summary: 'Поиск альбомов и сетов',
          responses: { '200': { description: 'Список альбомов' } },
        },
      },
      '/albums/{id}': {
        get: {
          tags: ['MUSIC'],
          summary: 'Получение альбома с треклистом',
          responses: { '200': { description: 'Альбом' } },
        },
      },
      '/library/favorites': {
        get: {
          tags: ['FAVORITES'],
          security: [{ BearerAuth: [] }],
          summary: 'Список избранных треков пользователя из D1',
          responses: { '200': { description: 'Избранные треки' } },
        },
        post: {
          tags: ['FAVORITES'],
          security: [{ BearerAuth: [] }],
          summary: 'Идемпотентное добавление трека в избранное',
          responses: { '201': { description: 'Добавлено в избранное' } },
        },
      },
      '/library/favorites/{trackId}': {
        delete: {
          tags: ['FAVORITES'],
          security: [{ BearerAuth: [] }],
          summary: 'Удаление трека из избранного',
          responses: { '200': { description: 'Удалено из избранного' } },
        },
      },
      '/playlists': {
        get: {
          tags: ['PLAYLISTS'],
          security: [{ BearerAuth: [] }],
          summary: 'Список плейлистов пользователя (лимит: 10 на пользователя)',
          responses: { '200': { description: 'Плейлисты пользователя' } },
        },
        post: {
          tags: ['PLAYLISTS'],
          security: [{ BearerAuth: [] }],
          summary: 'Создание плейлиста (максимум 10 плейлистов на пользователя)',
          responses: {
            '201': { description: 'Плейлист создан' },
            '400': { description: 'Превышен лимит 10 плейлистов' },
          },
        },
      },
      '/playlists/{id}': {
        get: {
          tags: ['PLAYLISTS'],
          summary: 'Получение плейлиста и его треков',
          responses: { '200': { description: 'Плейлист' } },
        },
        patch: {
          tags: ['PLAYLISTS'],
          security: [{ BearerAuth: [] }],
          summary: 'Обновление плейлиста с проверкой прав владельца и версии',
          responses: { '200': { description: 'Плейлист обновлён' } },
        },
        delete: {
          tags: ['PLAYLISTS'],
          security: [{ BearerAuth: [] }],
          summary: 'Удаление плейлиста владельцем',
          responses: { '200': { description: 'Плейлист удалён' } },
        },
      },
      '/playlists/{id}/tracks': {
        post: {
          tags: ['PLAYLISTS'],
          security: [{ BearerAuth: [] }],
          summary: 'Идемпотентное добавление трека в плейлист',
          responses: { '201': { description: 'Трек добавлен' } },
        },
      },
      '/playlists/{id}/tracks/{trackId}': {
        delete: {
          tags: ['PLAYLISTS'],
          security: [{ BearerAuth: [] }],
          summary: 'Удаление трека из плейлиста',
          responses: { '200': { description: 'Трек удалён' } },
        },
      },
      '/playlists/{id}/share': {
        post: {
          tags: ['PLAYLISTS'],
          security: [{ BearerAuth: [] }],
          summary: 'Создание публичной ссылки (shareId) для плейлиста',
          responses: { '200': { description: 'Публичная ссылка создана' } },
        },
      },
      '/playlists/public/{shareId}': {
        get: {
          tags: ['PLAYLISTS'],
          summary: 'Доступ к публичному плейлисту по shareId',
          responses: { '200': { description: 'Публичный плейлист' } },
        },
      },
      '/history': {
        get: {
          tags: ['HISTORY'],
          security: [{ BearerAuth: [] }],
          summary: 'Последние 15 уникальных прослушанных треков пользователя',
          responses: { '200': { description: 'История прослушиваний' } },
        },
        post: {
          tags: ['HISTORY'],
          security: [{ BearerAuth: [] }],
          summary: 'Запись прослушивания с автоматическим удержанием ровно 15 последних уникальных треков',
          responses: { '200': { description: 'История обновлена' } },
        },
        delete: {
          tags: ['HISTORY'],
          security: [{ BearerAuth: [] }],
          summary: 'Очистка истории прослушиваний',
          responses: { '200': { description: 'История очищена' } },
        },
      },
      '/recommendations': {
        get: {
          tags: ['RECOMMENDATIONS'],
          summary: 'Персональные рекомендации по режимам (Занятие, Характер, Настроение, Язык)',
          responses: { '200': { description: 'Ранжированные рекомендации с объяснением сигналов' } },
        },
      },
      '/recommendations/modes': {
        get: {
          tags: ['RECOMMENDATIONS'],
          summary: 'Справочник доступных режимов рекомендаций',
          responses: { '200': { description: 'Режимы рекомендаций' } },
        },
      },
      '/recommendations/track/{id}': {
        get: {
          tags: ['RECOMMENDATIONS'],
          summary: 'Отдельный механизм рекомендации похожих треков по реальным метаданным',
          responses: { '200': { description: 'Похожие треки' } },
        },
      },
      '/recommendations/feedback': {
        post: {
          tags: ['RECOMMENDATIONS'],
          security: [{ BearerAuth: [] }],
          summary: 'Сохранение обратной связи (like, dislike, skip, complete_listen, dismiss)',
          responses: { '201': { description: 'Отзыв сохранён' } },
        },
      },
      '/player/state': {
        get: {
          tags: ['PLAYER'],
          security: [{ BearerAuth: [] }],
          summary: 'Состояние плеера и список устройств с контролем активного устройства',
          responses: { '200': { description: 'Состояние плеера' } },
        },
        put: {
          tags: ['PLAYER'],
          security: [{ BearerAuth: [] }],
          summary: 'Синхронизация состояния плеера (D1 источник истины, версионирование, пауза других устройств)',
          responses: {
            '200': { description: 'Состояние синхронизировано' },
            '409': { description: 'Конфликт версий синхронизации (SYNC_VERSION_CONFLICT)' },
          },
        },
      },
      '/player/queue': {
        get: {
          tags: ['PLAYER'],
          security: [{ BearerAuth: [] }],
          summary: 'Получение очереди воспроизведения из D1',
          responses: { '200': { description: 'Очередь воспроизведения' } },
        },
        put: {
          tags: ['PLAYER'],
          security: [{ BearerAuth: [] }],
          summary: 'Обновление очереди воспроизведения с поддержкой Idempotency-Key и версионирования',
          responses: { '200': { description: 'Очередь сохранена' } },
        },
      },
      '/admin/statistics': {
        get: {
          tags: ['ADMIN'],
          security: [{ BearerAuth: [] }],
          summary: 'Полная статистика платформы и провайдеров (отдельный расчётный показатель SoundCloud raw / 2)',
          responses: { '200': { description: 'Статистика платформы' } },
        },
      },
      '/admin/users': {
        get: {
          tags: ['ADMIN'],
          security: [{ BearerAuth: [] }],
          summary: 'Список пользователей для модерации и администрирования',
          responses: { '200': { description: 'Список пользователей' } },
        },
      },
      '/admin/users/{id}': {
        patch: {
          tags: ['ADMIN'],
          security: [{ BearerAuth: [] }],
          summary: 'Изменение роли или блокировка пользователя (запрещено менять собственную роль)',
          responses: {
            '200': { description: 'Пользователь обновлён' },
            '403': { description: 'Запрет изменения собственной роли' },
          },
        },
      },
      '/admin/errors': {
        get: {
          tags: ['ADMIN'],
          security: [{ BearerAuth: [] }],
          summary: 'Журнал ошибок провайдеров, конфликтов синхронизации и событий безопасности',
          responses: { '200': { description: 'Журнал событий' } },
        },
      },
      '/admin/tracks/popular': {
        get: {
          tags: ['ADMIN'],
          security: [{ BearerAuth: [] }],
          summary: 'Популярные треки с раздельным хранением оригинальных и расчётных (raw / 2) показателей SoundCloud',
          responses: { '200': { description: 'Популярные треки' } },
        },
      },
      '/admin/settings': {
        get: {
          tags: ['ADMIN'],
          security: [{ BearerAuth: [] }],
          summary: 'Системные настройки платформы из D1',
          responses: { '200': { description: 'Системные настройки' } },
        },
        patch: {
          tags: ['ADMIN'],
          security: [{ BearerAuth: [] }],
          summary: 'Обновление системных настроек платформы',
          responses: { '200': { description: 'Настройка обновлена' } },
        },
      },
    },
  };
}

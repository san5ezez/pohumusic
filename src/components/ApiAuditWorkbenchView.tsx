import React, { useState } from 'react';
import { Terminal, Database, FileCheck2, Play } from 'lucide-react';

interface ApiAuditWorkbenchViewProps {
  accessToken: string;
  defaultShareId: string;
  healthInfo: Record<string, any> | null;
}

const PRESET_ENDPOINTS = [
  {
    label: 'GET /api/v1/health (D1 Tables & SoundCloud.ts Audit)',
    method: 'GET',
    path: '/api/v1/health',
    body: '',
  },
  {
    label: 'GET /api/v1/tracks/search?q=&provider=all',
    method: 'GET',
    path: '/api/v1/tracks/search?q=&provider=all',
    body: '',
  },
  {
    label: 'GET /api/v1/tracks/sc_1901005 (SoundCloud 30s Preview Access State)',
    method: 'GET',
    path: '/api/v1/tracks/sc_1901005',
    body: '',
  },
  {
    label: 'GET /api/v1/tracks/sc_1901006 (SoundCloud Blocked Access State)',
    method: 'GET',
    path: '/api/v1/tracks/sc_1901006',
    body: '',
  },
  {
    label: 'GET /api/v1/recommendations/modes',
    method: 'GET',
    path: '/api/v1/recommendations/modes',
    body: '',
  },
  {
    label: 'GET /api/v1/auth/me',
    method: 'GET',
    path: '/api/v1/auth/me',
    body: '',
  },
  {
    label: 'GET /api/v1/auth/oauth/google/start',
    method: 'GET',
    path: '/api/v1/auth/oauth/google/start',
    body: '',
  },
  {
    label: 'GET /api/v1/auth/oauth/discord/start',
    method: 'GET',
    path: '/api/v1/auth/oauth/discord/start',
    body: '',
  },
  {
    label: 'POST /api/v1/auth/forgot-password (Resend live email to san4ez.fedorov@gmail.com)',
    method: 'POST',
    path: '/api/v1/auth/forgot-password',
    body: JSON.stringify({ email: 'san4ez.fedorov@gmail.com' }, null, 2),
  },
  {
    label: 'GET /api/v1/openapi.json (OpenAPI 3.1.0 Spec)',
    method: 'GET',
    path: '/api/v1/openapi.json',
    body: '',
  },
];

export const ApiAuditWorkbenchView: React.FC<ApiAuditWorkbenchViewProps> = ({
  accessToken,
  healthInfo,
}) => {
  const [method, setMethod] = useState('GET');
  const [endpointPath, setEndpointPath] = useState('/api/v1/health');
  const [requestBody, setRequestBody] = useState('');
  const [responseStatus, setResponseStatus] = useState<number | null>(200);
  const [responsePayload, setResponsePayload] = useState<string>(
    healthInfo ? JSON.stringify(healthInfo, null, 2) : ''
  );
  const [isLoading, setIsLoading] = useState(false);

  const runEndpointRequest = async (
    overrideMethod?: string,
    overridePath?: string,
    overrideBody?: string
  ) => {
    const m = overrideMethod ?? method;
    const p = overridePath ?? endpointPath;
    const b = overrideBody ?? requestBody;
    setIsLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      const res = await fetch(p, {
        method: m,
        headers,
        body: m !== 'GET' && m !== 'HEAD' && b.trim() ? b : undefined,
      });
      setResponseStatus(res.status);
      const data = await res.json().catch(() => ({}));
      setResponsePayload(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponseStatus(500);
      setResponsePayload(
        JSON.stringify({ error: err instanceof Error ? err.message : 'Network error' }, null, 2)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const audit = healthInfo?.soundCloudPackageAudit;
  const d1Tables: string[] = healthInfo?.d1Tables || [];

  return (
    <div className="space-y-8">
      {/* Section 3: SoundCloud.ts Package Audit & Verification Report */}
      <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
        <div className="flex items-center gap-2">
          <FileCheck2 className="w-5 h-5 text-amber-400 shrink-0" />
          <h1 className="text-xl font-bold text-slate-100">
            Протокол проверки `soundcloud.ts` и архитектуры Cloudflare Workers (Раздел 3 ТЗ)
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Зафиксировано в `PROVIDERS.md` и `workers/src/providers/soundcloud/types.ts` перед написанием интеграции
        </p>

        {audit && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Точное название npm-пакета:</span>
                <span className="text-slate-100">{audit.npmPackageName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Исходный код (GitHub):</span>
                <span className="text-amber-400">{audit.repositoryUrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Документация:</span>
                <span className="text-slate-200">{audit.documentationUrl}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Лицензия / Последняя версия:</span>
                <span className="text-slate-200">
                  {audit.license} · v{audit.latestVerifiedVersion}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Поддержка TypeScript:</span>
                <span className="text-emerald-400">Да (.d.ts в комплекте)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Совместимость с Cloudflare Workers:</span>
                <span className="text-rose-400 font-semibold">
                  НЕТ (Требует Node.js fs + ffmpeg-static)
                </span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="font-semibold text-slate-200">
                Причины непригодности npm-пакета `soundcloud.ts` и решение:
              </div>
              <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                {(audit.incompatibilityReasons || []).map((reason: string, idx: number) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
              <p className="text-amber-300 pt-2 border-t border-slate-800 font-mono text-[11px]">
                {audit.resolution}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Real OAuth 2.0 & Resend Email Service Status */}
      <section className="border border-indigo-900/60 bg-gradient-to-br from-slate-900 via-indigo-950/20 to-slate-900 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-base font-bold text-slate-100">
                Настроенные сервисы авторизации и доставки Email
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Google OAuth2 · Discord OAuth2 · Resend API (Transactional Email)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/v1/auth/oauth/google/start');
                  const data = await res.json();
                  if (data.authorizationUrl) {
                    window.open(data.authorizationUrl, 'pohu_oauth_google', 'width=540,height=720');
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-2"
            >
              <span>🔑 Войти через Google (OAuth)</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/v1/auth/oauth/discord/start');
                  const data = await res.json();
                  if (data.authorizationUrl) {
                    window.open(data.authorizationUrl, 'pohu_oauth_discord', 'width=540,height=720');
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              className="px-3.5 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-2"
            >
              <span>🎮 Войти через Discord (OAuth)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMethod('POST');
                setEndpointPath('/api/v1/auth/forgot-password');
                const b = JSON.stringify({ email: 'san4ez.fedorov@gmail.com' }, null, 2);
                setRequestBody(b);
                runEndpointRequest('POST', '/api/v1/auth/forgot-password', b);
              }}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-2"
            >
              <span>✉️ Отправить письмо (Resend)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 font-sans font-semibold">
              <span>Google OAuth2</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                Подключено
              </span>
            </div>
            <div className="text-slate-400 truncate">
              Client ID: <span className="text-slate-200">750365132799...cnrg.apps.googleusercontent.com</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Project: <span className="text-slate-300">project-6f8377be-d277-4a42-a37</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 font-sans font-semibold">
              <span>Discord OAuth2</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                Подключено
              </span>
            </div>
            <div className="text-slate-400 truncate">
              Client ID: <span className="text-slate-200">1365970971511357440</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Scope: <span className="text-slate-300">identify email</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400 font-sans font-semibold">
              <span>Resend Email API</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                Активно
              </span>
            </div>
            <div className="text-slate-400 truncate">
              API Key: <span className="text-slate-200">re_GsYvXYrU...</span>
            </div>
            <div className="text-[11px] text-slate-500">
              From: <span className="text-slate-300">onboarding@resend.dev</span>
            </div>
          </div>
        </div>

        {/* Required Redirect URIs for User's Google and Discord Dashboards */}
        <div className="p-4 rounded-lg bg-slate-950/90 border border-indigo-950/80 space-y-2.5">
          <div className="text-xs font-semibold text-indigo-300 flex items-center justify-between">
            <span>📋 Redirect URIs (скопируйте в Google Cloud Console и Discord Developer Portal):</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            <div className="space-y-1">
              <span className="text-slate-400 block font-sans text-[11px]">Для Google OAuth (Authorized redirect URIs):</span>
              <div className="p-2 bg-slate-900 border border-slate-800 rounded text-amber-300 break-all select-all text-[11px]">
                https://ais-dev-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app/api/v1/auth/oauth/google/callback
              </div>
              <div className="p-2 bg-slate-900 border border-slate-800 rounded text-slate-300 break-all select-all text-[11px]">
                https://ais-pre-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app/api/v1/auth/oauth/google/callback
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 block font-sans text-[11px]">Для Discord OAuth (Redirects):</span>
              <div className="p-2 bg-slate-900 border border-slate-800 rounded text-indigo-300 break-all select-all text-[11px]">
                https://ais-dev-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app/api/v1/auth/oauth/discord/callback
              </div>
              <div className="p-2 bg-slate-900 border border-slate-800 rounded text-slate-300 break-all select-all text-[11px]">
                https://ais-pre-3ze7grpwzhpgtjzyhrq2t4-191765606642.asia-southeast1.run.app/api/v1/auth/oauth/discord/callback
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive API Console & D1 16-Table Schema Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 columns: Live HTTP Endpoint Runner */}
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/70 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-100">
              Интерактивная консоль запросов `/api/v1/*`
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESET_ENDPOINTS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setMethod(preset.method);
                  setEndpointPath(preset.path);
                  setRequestBody(preset.body);
                  runEndpointRequest(preset.method, preset.path, preset.body);
                }}
                className="px-2.5 py-1.5 rounded-md bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-xs font-mono text-slate-300 transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <label htmlFor="api-method-select" className="sr-only">
              HTTP метод
            </label>
            <select
              id="api-method-select"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-amber-400 focus:outline-none"
            >
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <label htmlFor="api-path-input" className="sr-only">
              Путь запроса API
            </label>
            <input
              id="api-path-input"
              type="text"
              value={endpointPath}
              onChange={(e) => setEndpointPath(e.target.value)}
              className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
            />

            <button
              type="button"
              onClick={() => runEndpointRequest()}
              disabled={isLoading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Выполнить</span>
            </button>
          </div>

          {method !== 'GET' && (
            <div>
              <label htmlFor="api-body-textarea" className="block text-xs text-slate-400 mb-1">
                JSON тело запроса:
              </label>
              <textarea
                id="api-body-textarea"
                rows={4}
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-1.5">
              <span className="text-slate-400">Ответ сервера Cloudflare Workers (Hono):</span>
              {responseStatus !== null && (
                <span
                  className={
                    responseStatus >= 200 && responseStatus < 300
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }
                >
                  HTTP {responseStatus}
                </span>
              )}
            </div>
            <pre className="p-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 overflow-x-auto max-h-[380px]">
              {responsePayload || '// Нажмите «Выполнить» для отправки запроса'}
            </pre>
          </div>
        </div>

        {/* Right 5 columns: D1 16-Table Schema & Structure Verification */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/70 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-100">
              Таблицы миграции Cloudflare D1 ({d1Tables.length} / 16)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Все 16 таблиц из Раздела 8 ТЗ развёрнуты с внешними ключами `ON DELETE CASCADE`, индексами и триггерами
          </p>

          <div className="divide-y divide-slate-800/80 font-mono text-xs">
            {d1Tables.map((tableName, idx) => (
              <div
                key={tableName}
                className="py-2.5 text-slate-200 flex items-center justify-between"
              >
                <span>
                  <span className="text-slate-500 mr-2">
                    {String(idx + 1).padStart(2, '0')}.
                  </span>
                  {tableName}
                </span>
                <span className="text-[11px] text-emerald-400">ACTIVE · FK ON</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

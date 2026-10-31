import React, { useState } from 'react';
import { Shield, BarChart3, Users, AlertTriangle, Settings } from 'lucide-react';

interface AdminConsoleViewProps {
  statistics: Record<string, any> | null;
  usersList: Array<Record<string, any>>;
  errorLogs: Array<Record<string, any>>;
  systemSettings: Array<Record<string, any>>;
  currentUserId: string;
  adminNotice: string | null;
  onUpdateUserRole: (userId: string, role: 'user' | 'moderator' | 'admin') => Promise<void>;
  onUpdateSystemSetting: (key: string, value: unknown) => Promise<void>;
}

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  statistics,
  usersList,
  errorLogs,
  systemSettings,
  currentUserId,
  adminNotice,
  onUpdateUserRole,
  onUpdateSystemSetting,
}) => {
  const [customSettingKey, setCustomSettingKey] = useState('quotas.max_playlists_per_user');
  const [customSettingValue, setCustomSettingValue] = useState('10');

  if (!statistics) {
    return (
      <div className="border border-slate-800 bg-slate-900/70 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-300">
          Доступ к `/api/v1/admin/*` разрешён только ролям `admin` и `moderator`. Переключитесь на аккаунт Администратора в правом верхнем углу.
        </p>
      </div>
    );
  }

  const popularTracks: Array<Record<string, any>> = statistics.popularTracks || [];

  return (
    <div className="space-y-8">
      {adminNotice && (
        <div
          role="status"
          className="p-4 rounded-xl bg-slate-900 border border-amber-500/50 text-xs font-mono text-amber-300"
        >
          {adminNotice}
        </div>
      )}

      {/* KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="text-xs text-slate-400">Пользователи / Активные (30д)</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
            {statistics.users?.totalUsers} / {statistics.users?.activeUsersLast30Days}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Админов: {statistics.users?.adminsCount} · Модераторов: {statistics.users?.moderatorsCount}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="text-xs text-slate-400">Прослушивания на платформе</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
            {statistics.listens?.totalPlatformPlaysAccumulated}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Избранное: {statistics.listens?.totalFavoritesCount} · Плейлистов:{' '}
            {statistics.listens?.totalPlaylistsCount}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="text-xs text-slate-400">
            SoundCloud: Исходный vs Расчётный (/2)
          </div>
          <div className="text-lg font-bold font-mono tabular-nums text-amber-400 mt-1">
            Raw: {Number(statistics.sources?.soundcloud?.rawProviderPlaysTotal || 0).toLocaleString('ru-RU')}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-300 mt-1">
            Расчётный (raw/2, неофиц.):{' '}
            {Number(statistics.sources?.soundcloud?.calculatedHalvedDisplayTotal || 0).toLocaleString('ru-RU')}
          </div>
        </div>

        <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/70">
          <div className="text-xs text-slate-400">События безопасности и ошибки</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-100 mt-1">
            {statistics.errors?.totalErrorsLogged}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Rate-limit: {statistics.errors?.rateLimitEventsCount} · Конфликты D1:{' '}
            {statistics.errors?.syncConflictsCount}
          </div>
        </div>
      </section>

      {/* Popular Tracks Table with SoundCloud Raw vs Calculated (/2) Separation */}
      <section className="border border-slate-800 bg-slate-900/70 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Популярные треки (`/api/v1/admin/tracks/popular`)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Оригинальные значения прослушиваний хранятся отдельно от расчётного показателя SoundCloud (деление на 2). Расчётный показатель не называется официальной статистикой SoundCloud.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/60">
                <th className="py-3 px-6 font-medium">Трек и исполнитель</th>
                <th className="py-3 px-4 font-medium">Источник</th>
                <th className="py-3 px-4 font-medium text-right">Прослушиваний в PohuMusic</th>
                <th className="py-3 px-4 font-medium text-right">Исходное значение (Raw)</th>
                <th className="py-3 px-6 font-medium text-right">
                  Расчётный показатель SC (Raw / 2, неофиц.)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {popularTracks.map((tr) => (
                <tr key={tr.trackId} className="hover:bg-slate-800/30">
                  <td className="py-3 px-6">
                    <div className="font-semibold text-slate-100">{tr.title}</div>
                    <div className="text-slate-400">{tr.artistName}</div>
                  </td>
                  <td className="py-3 px-4 font-mono uppercase text-slate-300">{tr.provider}</td>
                  <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-200">
                    {tr.pohuPlatformListens}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-right text-slate-200">
                    {Number(tr.rawProviderPlayCount || 0).toLocaleString('ru-RU')}
                  </td>
                  <td className="py-3 px-6 font-mono tabular-nums text-right text-amber-300">
                    {tr.calculatedSoundCloudHalvedDisplayMetric !== null
                      ? Number(tr.calculatedSoundCloudHalvedDisplayMetric).toLocaleString('ru-RU')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Users RBAC Management & System Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Users Management */}
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/70 rounded-xl p-6">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Управление пользователями и ролями (`/api/v1/admin/users`)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Попытка изменить собственную роль блокируется сервером (`403 SELF_ROLE_MODIFICATION_FORBIDDEN`)
          </p>

          <div className="mt-4 divide-y divide-slate-800/80">
            {usersList.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <div
                  key={u.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-100">
                      {u.display_name} (@{u.username}){isSelf ? ' — Вы' : ''}
                    </div>
                    <div className="text-slate-400 font-mono mt-0.5">
                      {u.email} · Роль: <span className="text-amber-400">{u.role}</span> · v{u.version}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {(['user', 'moderator', 'admin'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => onUpdateUserRole(u.id, r)}
                        className={`px-2.5 py-1.5 rounded-md font-mono text-xs transition-colors ${
                          u.role === r
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* System Settings & Error Logs */}
        <div className="lg:col-span-5 space-y-6">
          <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-slate-100">
                Системные настройки (`/api/v1/admin/settings`)
              </h2>
            </div>

            <div className="mt-4 space-y-2 text-xs font-mono">
              {systemSettings.map((s) => (
                <div
                  key={s.key}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                >
                  <span className="text-slate-300 truncate">{s.key}</span>
                  <span className="text-amber-400 shrink-0">{JSON.stringify(s.value)}</span>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                let parsed: unknown = customSettingValue;
                try {
                  parsed = JSON.parse(customSettingValue);
                } catch {
                  parsed = customSettingValue;
                }
                onUpdateSystemSetting(customSettingKey, parsed);
              }}
              className="mt-4 pt-4 border-t border-slate-800 flex gap-2"
            >
              <input
                type="text"
                value={customSettingKey}
                onChange={(e) => setCustomSettingKey(e.target.value)}
                aria-label="Ключ системной настройки"
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
              />
              <input
                type="text"
                value={customSettingValue}
                onChange={(e) => setCustomSettingValue(e.target.value)}
                aria-label="Значение системной настройки"
                className="w-20 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg whitespace-nowrap shrink-0"
              >
                Сохранить
              </button>
            </form>
          </section>

          <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-semibold text-slate-100">
                Журнал событий и ошибок (`/api/v1/admin/errors`)
              </h2>
            </div>

            <div className="mt-4 space-y-2.5 max-h-[260px] overflow-y-auto">
              {errorLogs.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-amber-400">
                      {log.category} · {log.action}
                    </span>
                    <span className="text-slate-400">{log.severity}</span>
                  </div>
                  <div className="text-slate-200">{log.message}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <div className="hidden">
        <Shield className="w-4 h-4" />
      </div>
    </div>
  );
};

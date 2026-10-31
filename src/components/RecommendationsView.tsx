import React from 'react';
import { ThumbsUp, ThumbsDown, SkipForward, Sparkles, Play } from 'lucide-react';
import { formatDurationMs, type Track } from '../types/api';

export interface RecommendationItem {
  track: Track;
  score: number;
  explanationReasons: string[];
  matchedSignals: {
    activityMatch: boolean;
    moodMatch: boolean;
    languageMatch: boolean;
    isFavoriteTrack: boolean;
    isFavoriteArtist: boolean;
    inHistory: boolean;
    penalizedBySkip: boolean;
  };
}

export interface SimilarTrackItem {
  track: Track;
  similarityScore: number;
  sharedMetadataAttributes: string[];
}

interface RecommendationsViewProps {
  activity: string;
  character: string;
  mood: string;
  language: string;
  recommendations: RecommendationItem[];
  similarSeedTrack: Track | null;
  similarTracks: SimilarTrackItem[];
  feedbackStatus: string | null;
  onModeChange: (axis: 'activity' | 'character' | 'mood' | 'language', value: string) => void;
  onSelectTrackToPlay: (track: Track) => void;
  onInspectSimilarForTrack: (track: Track) => void;
  onSubmitFeedback: (track: Track, type: 'like' | 'dislike' | 'skip') => void;
}

const ACTIVITIES = [
  { id: 'waking_up', label: 'Просыпаюсь' },
  { id: 'commuting', label: 'В дороге' },
  { id: 'working', label: 'Работаю' },
  { id: 'training', label: 'Тренируюсь' },
  { id: 'falling_asleep', label: 'Засыпаю' },
];

const CHARACTERS = [
  { id: 'favorite', label: 'Любимое' },
  { id: 'unfamiliar', label: 'Незнакомое' },
  { id: 'popular', label: 'Популярное' },
];

const MOODS = [
  { id: 'energetic', label: 'Бодрое' },
  { id: 'cheerful', label: 'Весёлое' },
  { id: 'calm', label: 'Спокойное' },
  { id: 'sad', label: 'Грустное' },
];

const LANGUAGES = [
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'Английский' },
  { id: 'any', label: 'Без разницы' },
  { id: 'instrumental', label: 'Без слов' },
];

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  activity,
  character,
  mood,
  language,
  recommendations,
  similarSeedTrack,
  similarTracks,
  feedbackStatus,
  onModeChange,
  onSelectTrackToPlay,
  onInspectSimilarForTrack,
  onSubmitFeedback,
}) => {
  return (
    <div className="space-y-8">
      {/* 4-Axis Mode Selector */}
      <section className="border border-slate-800 bg-slate-900/70 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Серверный алгоритм рекомендаций (`/api/v1/recommendations`)
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Учитывает историю прослушиваний, избранное, пропуски, любимых исполнителей и обратную связь в D1 · Использует только реальные метаданные провайдеров
            </p>
          </div>
          {feedbackStatus && (
            <div className="text-xs font-mono text-amber-300 bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg">
              {feedbackStatus}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mt-6">
          {/* Activity */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2">1. Занятие</div>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onModeChange('activity', item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activity === item.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Character */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2">2. Характер</div>
            <div className="flex flex-wrap gap-1.5">
              {CHARACTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onModeChange('character', item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    character === item.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2">3. Настроение</div>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onModeChange('mood', item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    mood === item.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <div className="text-xs font-semibold text-slate-300 mb-2">4. Язык</div>
            <div className="flex flex-wrap gap-1.5">
              {LANGUAGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onModeChange('language', item.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    language === item.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2-Column Split: Ranked Recommendations + Similar Tracks Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/70 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                Персональная подборка ({recommendations.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Заблокированные (`blocked`) и отклонённые (`dislike`) треки автоматически исключены
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-800/80">
            {recommendations.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm text-slate-400">
                  Для выбранного сочетания фильтров подходящих треков не найдено. Попробуйте выбрать язык «Без разницы» или характер «Любимое».
                </p>
              </div>
            ) : (
              recommendations.map((item) => (
                <div
                  key={item.track.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onSelectTrackToPlay(item.track)}
                        className="text-sm font-semibold text-slate-100 hover:text-amber-400 transition-colors truncate text-left"
                      >
                        {item.track.title}
                      </button>
                      <span className="font-mono tabular-nums text-xs text-amber-400 shrink-0">
                        score:{item.score}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mt-1">
                      {item.track.artistName} · {item.track.provider.toUpperCase()} ·{' '}
                      {formatDurationMs(item.track.durationMs)} · Язык: {item.track.language}
                    </div>

                    <div className="text-xs text-slate-300 mt-1.5">
                      Сигналы ранжирования: {item.explanationReasons.join(' · ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSubmitFeedback(item.track, 'like')}
                      aria-label={`Нравится «${item.track.title}»`}
                      className="p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSubmitFeedback(item.track, 'skip')}
                      aria-label={`Отметить пропуск «${item.track.title}»`}
                      className="p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSubmitFeedback(item.track, 'dislike')}
                      aria-label={`Не предлагать «${item.track.title}»`}
                      className="p-2 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onInspectSimilarForTrack(item.track)}
                      className="px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-xs font-medium text-slate-200 hover:border-amber-500/50 transition-colors whitespace-nowrap shrink-0"
                    >
                      Похожие
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dedicated Similar Tracks Mechanism */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/70 rounded-xl p-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-base font-semibold text-slate-100">
              Похожие треки (`/recommendations/track/:id`)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Отдельный механизм поиска похожих композиций по общим тегам, жанру, артисту и языку
          </p>

          {similarSeedTrack && (
            <div className="mt-4 p-3.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-400">Исходный трек (Seed):</div>
              <div className="text-sm font-semibold text-slate-100 mt-0.5">
                {similarSeedTrack.title}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {similarSeedTrack.artistName} · {similarSeedTrack.genre || 'Electronic'} · Теги:{' '}
                {similarSeedTrack.tags.slice(0, 5).join(', ')}
              </div>
            </div>
          )}

          <div className="mt-4 divide-y divide-slate-800/80">
            {similarTracks.map((sim) => (
              <div key={sim.track.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-100 truncate">
                    {sim.track.title}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {sim.track.artistName} · Сходство:{' '}
                    <span className="font-mono tabular-nums text-amber-400">
                      {sim.similarityScore}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    {sim.sharedMetadataAttributes.join(' · ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTrackToPlay(sim.track)}
                  aria-label={`Воспроизвести похожий трек ${sim.track.title}`}
                  className="p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-slate-200 shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

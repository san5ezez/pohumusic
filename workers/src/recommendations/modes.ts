// ============================================================================
// POHUMUSIC — RECOMMENDATION MODES & REAL METADATA KEYWORD TAXONOMY
// ============================================================================
// Section 10: Does NOT invent or hallucinate acoustic features (like fake
// Spotify AudioFeatures valence/energy floats) when the upstream provider
// does not supply them. Matches strictly on actual provider tags, genre,
// duration, language, and user D1 signals (favorites, history, skips, feedback).
// ============================================================================

export type ActivityMode = 'waking_up' | 'commuting' | 'working' | 'training' | 'falling_asleep';
export type CharacterMode = 'favorite' | 'unfamiliar' | 'popular';
export type MoodMode = 'energetic' | 'cheerful' | 'calm' | 'sad';
export type LanguageMode = 'ru' | 'en' | 'any' | 'instrumental';

export interface RecommendationModeDefinition<T extends string> {
  id: T;
  labelRu: string;
  labelEn: string;
  description: string;
  matchedProviderTags: string[];
}

export const ACTIVITY_MODES: RecommendationModeDefinition<ActivityMode>[] = [
  {
    id: 'waking_up',
    labelRu: 'Просыпаюсь',
    labelEn: 'Waking Up',
    description: 'Плавный утренний старт: акустика, инди, светлая электроника',
    matchedProviderTags: ['waking_up', 'morning', 'просыпаюсь', 'acoustic', 'indie', 'lo-fi'],
  },
  {
    id: 'commuting',
    labelRu: 'В дороге',
    labelEn: 'On the Road',
    description: 'Ритмичный драйв для поездок, синтвейв, пост-панк и электроника',
    matchedProviderTags: ['commuting', 'driving', 'night', 'в дороге', 'synthwave', 'post-punk', 'house'],
  },
  {
    id: 'working',
    labelRu: 'Работаю',
    labelEn: 'Working',
    description: 'Глубокая концентрация без отвлекающих перепадов',
    matchedProviderTags: ['working', 'focus', 'работаю', 'ambient', 'modular', 'lo-fi', 'instrumental'],
  },
  {
    id: 'training',
    labelRu: 'Тренируюсь',
    labelEn: 'Training',
    description: 'Высокий темп и плотная ритм-секция для спорта',
    matchedProviderTags: ['training', 'workout', 'тренируюсь', 'techno', 'electro', 'breakbeat', 'energetic'],
  },
  {
    id: 'falling_asleep',
    labelRu: 'Засыпаю',
    labelEn: 'Falling Asleep',
    description: 'Спокойный эмбиент, неоклассика и мягкие текстуры',
    matchedProviderTags: ['falling_asleep', 'sleep', 'засыпаю', 'ambient', 'piano', 'neoclassical', 'calm'],
  },
];

export const CHARACTER_MODES: RecommendationModeDefinition<CharacterMode>[] = [
  {
    id: 'favorite',
    labelRu: 'Любимое',
    labelEn: 'Favorite & Familiar',
    description: 'Треки из избранного, истории и от любимых исполнителей',
    matchedProviderTags: [],
  },
  {
    id: 'unfamiliar',
    labelRu: 'Незнакомое',
    labelEn: 'Discovery / Unfamiliar',
    description: 'Новые треки и артисты, которых ещё нет в вашей истории и избранном',
    matchedProviderTags: [],
  },
  {
    id: 'popular',
    labelRu: 'Популярное',
    labelEn: 'Popular',
    description: 'Лидеры по прослушиваниям и лайкам в источниках',
    matchedProviderTags: [],
  },
];

export const MOOD_MODES: RecommendationModeDefinition<MoodMode>[] = [
  {
    id: 'energetic',
    labelRu: 'Бодрое',
    labelEn: 'Energetic',
    description: 'Динамичные и заряжающие композиции',
    matchedProviderTags: ['energetic', 'бодрое', 'techno', 'electro', 'driving', 'workout', 'synthwave'],
  },
  {
    id: 'cheerful',
    labelRu: 'Весёлое',
    labelEn: 'Cheerful',
    description: 'Светлое, позитивное и приподнятое звучание',
    matchedProviderTags: ['cheerful', 'весёлое', 'morning', 'indie', 'folk', 'upbeat'],
  },
  {
    id: 'calm',
    labelRu: 'Спокойное',
    labelEn: 'Calm',
    description: 'Уравновешенная атмосфера и ровный баланс',
    matchedProviderTags: ['calm', 'спокойное', 'ambient', 'focus', 'modular', 'lo-fi'],
  },
  {
    id: 'sad',
    labelRu: 'Грустное',
    labelEn: 'Melancholic / Sad',
    description: 'Меланхоличная лирика, пост-панк и ноктюрны',
    matchedProviderTags: ['sad', 'грустное', 'post-punk', 'coldwave', 'nocturne', 'piano'],
  },
];

export const LANGUAGE_MODES: RecommendationModeDefinition<LanguageMode>[] = [
  {
    id: 'ru',
    labelRu: 'Русский',
    labelEn: 'Russian',
    description: 'Треки на русском языке',
    matchedProviderTags: ['russian', 'ru'],
  },
  {
    id: 'en',
    labelRu: 'Английский',
    labelEn: 'English',
    description: 'Треки на английском языке',
    matchedProviderTags: ['english', 'en'],
  },
  {
    id: 'any',
    labelRu: 'Без разницы',
    labelEn: 'Any Language',
    description: 'Любой язык исполнения',
    matchedProviderTags: [],
  },
  {
    id: 'instrumental',
    labelRu: 'Без слов',
    labelEn: 'Instrumental / No Vocals',
    description: 'Инструментальная музыка без вокала',
    matchedProviderTags: ['instrumental', 'без слов', 'ambient', 'modular'],
  },
];

const RU_TO_ACTIVITY: Record<string, ActivityMode> = {
  просыпаюсь: 'waking_up',
  waking_up: 'waking_up',
  'в дороге': 'commuting',
  commuting: 'commuting',
  работаю: 'working',
  working: 'working',
  тренируюсь: 'training',
  training: 'training',
  засыпаю: 'falling_asleep',
  falling_asleep: 'falling_asleep',
};

const RU_TO_CHARACTER: Record<string, CharacterMode> = {
  любимое: 'favorite',
  favorite: 'favorite',
  незнакомое: 'unfamiliar',
  unfamiliar: 'unfamiliar',
  популярное: 'popular',
  popular: 'popular',
};

const RU_TO_MOOD: Record<string, MoodMode> = {
  бодрое: 'energetic',
  energetic: 'energetic',
  весёлое: 'cheerful',
  веселое: 'cheerful',
  cheerful: 'cheerful',
  спокойное: 'calm',
  calm: 'calm',
  грустное: 'sad',
  sad: 'sad',
};

const RU_TO_LANGUAGE: Record<string, LanguageMode> = {
  русский: 'ru',
  ru: 'ru',
  английский: 'en',
  en: 'en',
  'без разницы': 'any',
  any: 'any',
  'без слов': 'instrumental',
  instrumental: 'instrumental',
};

export function normalizeActivityMode(val?: string | null): ActivityMode {
  if (!val) return 'working';
  return RU_TO_ACTIVITY[val.trim().toLowerCase()] || 'working';
}

export function normalizeCharacterMode(val?: string | null): CharacterMode {
  if (!val) return 'favorite';
  return RU_TO_CHARACTER[val.trim().toLowerCase()] || 'favorite';
}

export function normalizeMoodMode(val?: string | null): MoodMode {
  if (!val) return 'calm';
  return RU_TO_MOOD[val.trim().toLowerCase()] || 'calm';
}

export function normalizeLanguageMode(val?: string | null): LanguageMode {
  if (!val) return 'any';
  return RU_TO_LANGUAGE[val.trim().toLowerCase()] || 'any';
}

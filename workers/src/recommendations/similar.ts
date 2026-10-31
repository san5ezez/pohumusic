// ============================================================================
// POHUMUSIC — SIMILAR TRACK RECOMMENDATION MECHANISM
// ============================================================================
// Dedicated mechanism for `/api/v1/recommendations/track/:id`.
// Computes similarity strictly from provider metadata (shared tags, genre,
// artist, language, and provider related-tracks API) without fabricating
// unprovided acoustic features.
// ============================================================================

import type { Track } from '../providers/music-provider';

export interface SimilarTrackRecommendation {
  track: Track;
  similarityScore: number;
  sharedMetadataAttributes: string[];
}

export function rankSimilarTracksPure(
  seedTrack: Track,
  candidatePool: Track[],
  limit = 8
): SimilarTrackRecommendation[] {
  const seedTags = new Set(seedTrack.tags.map((t) => t.toLowerCase()));
  const seedGenre = (seedTrack.genre || '').toLowerCase();

  const results: SimilarTrackRecommendation[] = [];

  for (const candidate of candidatePool) {
    if (candidate.id === seedTrack.id) continue;
    if (candidate.accessState === 'blocked') continue;

    let similarityScore = 0;
    const sharedAttributes: string[] = [];

    if (candidate.artistId === seedTrack.artistId) {
      similarityScore += 30;
      sharedAttributes.push(`Один исполнитель (${seedTrack.artistName})`);
    }

    if (seedGenre && (candidate.genre || '').toLowerCase() === seedGenre) {
      similarityScore += 25;
      sharedAttributes.push(`Общий жанр (${seedTrack.genre})`);
    }

    const matchingTags: string[] = [];
    for (const tag of candidate.tags) {
      if (seedTags.has(tag.toLowerCase())) {
        matchingTags.push(tag);
      }
    }
    if (matchingTags.length > 0) {
      similarityScore += matchingTags.length * 12;
      sharedAttributes.push(`Общие теги: ${matchingTags.slice(0, 4).join(', ')}`);
    }

    if (candidate.language === seedTrack.language) {
      similarityScore += 10;
      sharedAttributes.push(`Совпадение языка (${seedTrack.language})`);
    }

    if (candidate.provider === seedTrack.provider) {
      similarityScore += 5;
    }

    if (sharedAttributes.length === 0) {
      sharedAttributes.push('Рекомендовано провайдером как связанный трек');
      similarityScore += 5;
    }

    results.push({
      track: candidate,
      similarityScore,
      sharedMetadataAttributes: sharedAttributes,
    });
  }

  results.sort(
    (a, b) => b.similarityScore - a.similarityScore || b.track.rawPlayCount - a.track.rawPlayCount
  );

  return results.slice(0, limit);
}

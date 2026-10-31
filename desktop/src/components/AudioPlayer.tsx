import React, { useEffect, useRef, useState } from 'react';
import type { Track } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
    SC: any;
  }
}

interface AudioPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  positionMs: number;
  seekPositionMs?: number | null;
  onPositionUpdate: (posMs: number) => void;
  onTrackEnded: () => void;
}

// Singleton promise for YouTube IFrame API script loading
let ytApiPromise: Promise<any> | null = null;
function loadYouTubeApi(): Promise<any> {
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        const first = document.getElementsByTagName('script')[0];
        first?.parentNode?.insertBefore(tag, first);
      }
      const check = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(check);
          resolve(window.YT);
        }
      }, 50);
    });
  }
  return ytApiPromise;
}

// Singleton promise for SoundCloud Widget API
let scApiPromise: Promise<any> | null = null;
function loadSoundCloudApi(): Promise<any> {
  if (window.SC && window.SC.Widget) {
    return Promise.resolve(window.SC);
  }
  if (!scApiPromise) {
    scApiPromise = new Promise((resolve) => {
      if (!document.getElementById('sc-widget-api')) {
        const tag = document.createElement('script');
        tag.id = 'sc-widget-api';
        tag.src = 'https://w.soundcloud.com/player/api.js';
        const first = document.getElementsByTagName('script')[0];
        first?.parentNode?.insertBefore(tag, first);
      }
      const check = setInterval(() => {
        if (window.SC && window.SC.Widget) {
          clearInterval(check);
          resolve(window.SC);
        }
      }, 50);
    });
  }
  return scApiPromise;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  volume,
  seekPositionMs,
  onPositionUpdate,
  onTrackEnded,
}) => {
  const ytPlayerRef = useRef<any>(null);
  const scWidgetRef = useRef<any>(null);
  const scIframeRef = useRef<HTMLIFrameElement | null>(null);

  const lastTrackIdRef = useRef<string | null>(null);
  const lastSeekMsRef = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const currentTrackRef = useRef(currentTrack);

  const [isYtReady, setIsYtReady] = useState(false);
  const [isScReady, setIsScReady] = useState(false);

  isPlayingRef.current = isPlaying;
  volumeRef.current = volume;
  currentTrackRef.current = currentTrack;

  const isYouTube = Boolean(
    currentTrack && (currentTrack.provider === 'youtube' || currentTrack.id.startsWith('yt_'))
  );
  const ytVideoId = currentTrack ? currentTrack.id.replace(/^yt_/, '') : '';

  // 1. Initialize YouTube Player
  useEffect(() => {
    let isCancelled = false;

    loadYouTubeApi().then((YT) => {
      if (isCancelled || ytPlayerRef.current) return;

      try {
        ytPlayerRef.current = new YT.Player('yt-audio-container', {
          height: '1',
          width: '1',
          videoId: ytVideoId || '92kw0u3GUZo',
          playerVars: {
            autoplay: 0,
            controls: 0,
            playsinline: 1,
            disablekb: 1,
            fs: 0,
            rel: 0,
          },
          events: {
            onReady: (event: any) => {
              if (isCancelled) return;
              setIsYtReady(true);
              event.target.setVolume(Math.round(volumeRef.current * 100));

              // If current track is YouTube and isPlaying was already requested
              if (currentTrackRef.current) {
                const trackIsYt =
                  currentTrackRef.current.provider === 'youtube' ||
                  currentTrackRef.current.id.startsWith('yt_');
                if (trackIsYt) {
                  const vid = currentTrackRef.current.id.replace(/^yt_/, '');
                  if (isPlayingRef.current) {
                    event.target.loadVideoById(vid, 0);
                  } else {
                    event.target.cueVideoById(vid, 0);
                  }
                }
              }
            },
            onStateChange: (event: any) => {
              // 0 = ENDED
              if (event.data === 0) {
                onTrackEnded();
              }
            },
          },
        });
      } catch (err) {
        console.error('Failed to instantiate YT.Player', err);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [onTrackEnded]);

  // 2. Initialize SoundCloud Widget
  useEffect(() => {
    if (!scIframeRef.current) return;

    loadSoundCloudApi().then((SC) => {
      if (!scIframeRef.current) return;
      try {
        const widget = SC.Widget(scIframeRef.current);
        scWidgetRef.current = widget;

        widget.bind(SC.Widget.Events.READY, () => {
          setIsScReady(true);
          widget.setVolume(Math.round(volumeRef.current * 100));

          // If current track is SoundCloud and isPlaying was requested
          if (currentTrackRef.current) {
            const trackIsYt =
              currentTrackRef.current.provider === 'youtube' ||
              currentTrackRef.current.id.startsWith('yt_');
            if (!trackIsYt) {
              const scUrl =
                currentTrackRef.current.externalUrl ||
                currentTrackRef.current.permalinkUrl ||
                'https://soundcloud.com';
              widget.load(scUrl, {
                auto_play: isPlayingRef.current,
                callback: () => {
                  widget.setVolume(Math.round(volumeRef.current * 100));
                },
              });
            }
          }
        });

        widget.bind(SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
          if (data && typeof data.currentPosition === 'number') {
            onPositionUpdate(data.currentPosition);
          }
        });

        widget.bind(SC.Widget.Events.FINISH, () => {
          onTrackEnded();
        });
      } catch (err) {
        console.error('SoundCloud widget error', err);
      }
    });
  }, [onPositionUpdate, onTrackEnded]);

  // 3. Track change effect: ONLY runs when currentTrack.id actually changes!
  useEffect(() => {
    if (!currentTrack) return;
    if (currentTrack.id === lastTrackIdRef.current) return;
    lastTrackIdRef.current = currentTrack.id;
    lastSeekMsRef.current = null;

    // Reset UI position to 0 for the new track
    onPositionUpdate(0);

    if (isYouTube) {
      // Pause SoundCloud if it was playing
      if (scWidgetRef.current) {
        try {
          scWidgetRef.current.pause();
        } catch {}
      }

      if (ytPlayerRef.current && isYtReady) {
        try {
          if (isPlayingRef.current) {
            ytPlayerRef.current.loadVideoById(ytVideoId, 0);
          } else {
            ytPlayerRef.current.cueVideoById(ytVideoId, 0);
          }
        } catch {}
      }
    } else {
      // SoundCloud
      // Pause YouTube if it was playing
      if (ytPlayerRef.current && isYtReady) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch {}
      }

      if (scWidgetRef.current && isScReady) {
        const scUrl =
          currentTrack.externalUrl || currentTrack.permalinkUrl || 'https://soundcloud.com';
        try {
          scWidgetRef.current.load(scUrl, {
            auto_play: isPlayingRef.current,
            callback: () => {
              scWidgetRef.current?.setVolume(Math.round(volumeRef.current * 100));
            },
          });
        } catch {}
      }
    }
  }, [currentTrack?.id, isYouTube, ytVideoId, isYtReady, isScReady, onPositionUpdate]);

  // 4. Play/Pause toggle effect: ONLY toggles playback state WITHOUT restarting from 0:00!
  useEffect(() => {
    if (!currentTrack) return;

    if (isYouTube) {
      if (!ytPlayerRef.current || !isYtReady) return;
      try {
        if (isPlaying) {
          ytPlayerRef.current.playVideo();
        } else {
          ytPlayerRef.current.pauseVideo();
        }
      } catch {}
    } else {
      if (!scWidgetRef.current || !isScReady) return;
      try {
        if (isPlaying) {
          scWidgetRef.current.play();
        } else {
          scWidgetRef.current.pause();
        }
      } catch {}
    }
  }, [isPlaying, isYouTube, isYtReady, isScReady, currentTrack?.id]);

  // 5. Seek effect: jumps directly to the targeted second/millisecond
  useEffect(() => {
    if (typeof seekPositionMs !== 'number' || isNaN(seekPositionMs)) return;
    if (seekPositionMs === lastSeekMsRef.current) return;
    lastSeekMsRef.current = seekPositionMs;

    onPositionUpdate(seekPositionMs);

    if (isYouTube) {
      if (!ytPlayerRef.current || !isYtReady) return;
      try {
        const seekSec = Math.floor(seekPositionMs / 1000);
        ytPlayerRef.current.seekTo(seekSec, true);
        if (isPlayingRef.current) {
          ytPlayerRef.current.playVideo();
        }
      } catch {}
    } else {
      if (!scWidgetRef.current || !isScReady) return;
      try {
        scWidgetRef.current.seekTo(seekPositionMs);
        if (isPlayingRef.current) {
          scWidgetRef.current.play();
        }
      } catch {}
    }
  }, [seekPositionMs, isYouTube, isYtReady, isScReady, onPositionUpdate]);

  // 6. Volume effect
  useEffect(() => {
    const volPercent = Math.round(Math.max(0, Math.min(1, volume)) * 100);
    if (ytPlayerRef.current && isYtReady) {
      try {
        ytPlayerRef.current.setVolume(volPercent);
      } catch {}
    }
    if (scWidgetRef.current && isScReady) {
      try {
        scWidgetRef.current.setVolume(volPercent);
      } catch {}
    }
  }, [volume, isYtReady, isScReady]);

  // 7. Polling YouTube progress directly from YouTube Player (only while actively playing)
  useEffect(() => {
    if (!isPlaying || !isYouTube || !isYtReady) return;

    const interval = setInterval(() => {
      try {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
          const state = ytPlayerRef.current.getPlayerState?.();
          // State 1 is PLAYING (not buffering = 3, not cued = 5, not paused = 2)
          if (state === 1) {
            const currentSec = ytPlayerRef.current.getCurrentTime();
            if (typeof currentSec === 'number' && !isNaN(currentSec)) {
              onPositionUpdate(Math.round(currentSec * 1000));
            }
          }
        }
      } catch {}
    }, 400);

    return () => clearInterval(interval);
  }, [isPlaying, isYouTube, isYtReady, onPositionUpdate]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: -9999,
        right: -9999,
        width: 1,
        height: 1,
        opacity: 0.01,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* Official YouTube Player Container (replaced by YT.Player) */}
      <div id="yt-audio-container" />

      {/* Official SoundCloud Widget Iframe */}
      <iframe
        id="sc-player-iframe"
        ref={scIframeRef}
        src="https://w.soundcloud.com/player/?url=https%3A//soundcloud.com&auto_play=false"
        allow="autoplay"
        title="PohuMusic SoundCloud Audio Engine"
        style={{ width: 1, height: 1, border: 0 }}
      />
    </div>
  );
};

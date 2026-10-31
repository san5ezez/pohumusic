import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Track } from '../types';

interface AudioPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  positionMs: number;
  seekPositionMs?: number | null;
  onPositionUpdate: (posMs: number) => void;
  onTrackEnded: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  volume,
  seekPositionMs,
  onPositionUpdate,
  onTrackEnded,
}) => {
  const positionRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isBuffering, setIsBuffering] = useState(true);

  isPlayingRef.current = isPlaying;

  // PostMessage helper to talk to YouTube / SoundCloud iframe
  const sendIframeCommand = useCallback((command: string, args: any[] = []) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    try {
      if (currentTrack?.provider === 'youtube' || currentTrack?.id.startsWith('yt_')) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: command,
            args,
          }),
          '*'
        );
      } else {
        // SoundCloud Widget API format
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            method: command,
            value: args[0],
          }),
          '*'
        );
      }
    } catch {}
  }, [currentTrack]);

  // Reset position and set buffering when changing track
  useEffect(() => {
    positionRef.current = 0;
    setIsBuffering(true);
    onPositionUpdate(0);

    // Initial buffering grace period: audio takes ~1.2s to start loading
    const timer = setTimeout(() => {
      setIsBuffering(false);
    }, 1400);

    return () => clearTimeout(timer);
  }, [currentTrack?.id, onPositionUpdate]);

  // Handle Play/Pause toggling
  useEffect(() => {
    if (!currentTrack) return;
    if (isPlaying) {
      sendIframeCommand('playVideo');
      sendIframeCommand('play');
      // If resuming from pause at a later position, ensure iframe player seeks to exact saved time
      if (positionRef.current > 1000) {
        const seekSec = Math.floor(positionRef.current / 1000);
        sendIframeCommand('seekTo', [seekSec, true]);
        sendIframeCommand('seekTo', [positionRef.current]);
      }
    } else {
      sendIframeCommand('pauseVideo');
      sendIframeCommand('pause');
    }
  }, [isPlaying, currentTrack, sendIframeCommand]);

  // Handle Seeking / Scrubbing
  useEffect(() => {
    if (typeof seekPositionMs === 'number' && !isNaN(seekPositionMs)) {
      positionRef.current = seekPositionMs;
      onPositionUpdate(seekPositionMs);

      const seekSec = Math.floor(seekPositionMs / 1000);
      sendIframeCommand('seekTo', [seekSec, true]); // YouTube: seconds
      sendIframeCommand('seekTo', [seekPositionMs]);  // SoundCloud: ms
    }
  }, [seekPositionMs, onPositionUpdate, sendIframeCommand]);

  // Handle Volume changes
  useEffect(() => {
    const volPercent = Math.round(Math.max(0, Math.min(1, volume)) * 100);
    sendIframeCommand('setVolume', [volPercent]);
  }, [volume, sendIframeCommand]);

  // Listen to postMessage from YouTube/SoundCloud
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        let data = event.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return;
          }
        }
        if (!data) return;

        // YouTube Player State Change: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
        if (data.event === 'onStateChange') {
          if (data.info === 1) {
            setIsBuffering(false);
          } else if (data.info === 3) {
            setIsBuffering(true);
          } else if (data.info === 0) {
            onTrackEnded();
          }
        }

        // Exact YouTube playback progress report
        if (data.info && typeof data.info.currentTime === 'number') {
          const exactMs = Math.round(data.info.currentTime * 1000);
          positionRef.current = exactMs;
          onPositionUpdate(exactMs);
          setIsBuffering(false);
        }

        // SoundCloud Progress
        if (data.method === 'playProgress' && typeof data.value?.currentPosition === 'number') {
          positionRef.current = data.value.currentPosition;
          onPositionUpdate(data.value.currentPosition);
          setIsBuffering(false);
        }
        if (data.method === 'finish') {
          onTrackEnded();
        }
      } catch {}
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPositionUpdate, onTrackEnded]);

  // Position ticker: advances time ONLY when playing and not buffering
  useEffect(() => {
    if (!isPlaying || !currentTrack || isBuffering) return;

    const interval = setInterval(() => {
      positionRef.current += 1000;
      onPositionUpdate(positionRef.current);

      const maxDuration = (currentTrack.durationSeconds || 180) * 1000;
      if (positionRef.current >= maxDuration) {
        onTrackEnded();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, isBuffering, onPositionUpdate, onTrackEnded]);

  if (!currentTrack) return null;

  const isYouTube = currentTrack.provider === 'youtube' || currentTrack.id.startsWith('yt_');
  const ytVideoId = currentTrack.id.replace(/^yt_/, '');

  return (
    <div
      className="fixed -bottom-96 -right-96 w-1 h-1 opacity-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {isYouTube ? (
        <iframe
          ref={iframeRef}
          key={`yt-${ytVideoId}`}
          src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=1&enablejsapi=1&playsinline=1&controls=0&origin=${encodeURIComponent(
            window.location.origin
          )}`}
          allow="autoplay; encrypted-media"
          title="PohuMusic YouTube Audio Engine"
          className="w-1 h-1 border-0"
        />
      ) : (
        <iframe
          ref={iframeRef}
          key={`sc-${currentTrack.id}`}
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(
            currentTrack.externalUrl || currentTrack.permalinkUrl || 'https://soundcloud.com'
          )}&auto_play=true&buying=false&sharing=false&download=false&show_artwork=false&show_comments=false&show_playcount=false`}
          allow="autoplay"
          title="PohuMusic SoundCloud Audio Engine"
          className="w-1 h-1 border-0"
        />
      )}
    </div>
  );
};

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useOCount, useSetOCount } from '@/config/OCountContext';
import { usePlayback } from '@/config/PlaybackContext';
import { useServerConfig } from '@/config/ServerConfigContext';
import { makeClient } from '@/lib/graphql';
import { incrementSceneO } from '@/lib/queries';
import { withCookie } from '@/lib/session';
import { authenticatedURL } from '@/lib/stashUrl';
import type { Scene } from '@/types/stash';

const HIDE_DELAY = 3500;

function fmt(seconds: number): string {
  let s = Math.floor(isFinite(seconds) && seconds > 0 ? seconds : 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  s = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export default function PlayerScreen() {
  const router = useRouter();
  const { playlist } = usePlayback();
  const server = useServerConfig();

  // Pair each playable stream with its scene so the o-counter stays aligned.
  const entries = useMemo(() => {
    if (!playlist) return [] as { scene: Scene; url: string }[];
    return playlist.scenes
      .slice(playlist.startIndex)
      .map((scene) => ({ scene, url: authenticatedURL(scene.paths.stream, server.apiKey) }))
      .filter((e): e is { scene: Scene; url: string } => e.url != null);
  }, [playlist, server.apiKey]);

  const [index, setIndex] = useState(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const player = useVideoPlayer(entries[0] ? withCookie(entries[0].url) : null, (p) => {
    if (playlist?.startTime && playlist.startTime > 0) p.currentTime = playlist.startTime;
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackW, setTrackW] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  // Mirror scrub into a ref so the timeUpdate listener (registered once) can
  // tell whether the user is mid-drag without re-subscribing.
  const scrubRef = useRef<number | null>(null);
  scrubRef.current = scrub;

  // O-count is read from / written to the shared store so increments propagate
  // back to the browse cards without a refetch.
  const setOCountStore = useSetOCount();
  const currentScene = entries[index]?.scene;
  const oCount = useOCount(currentScene?.id ?? '', currentScene?.o_counter);

  // Player event wiring.
  useEffect(() => {
    const subPlay = player.addListener('playingChange', (e) => setIsPlaying(e.isPlaying));
    const subTime = player.addListener('timeUpdate', (e) => {
      // While the user is scrubbing, the bar follows the finger — don't let live
      // playback updates move the playhead underneath the drag (that ghost
      // playhead is what snaps the position backwards on release).
      if (scrubRef.current != null) return;
      setCurrentTime(e.currentTime ?? 0);
      if (player.duration) setDuration(player.duration);
    });
    const subEnd = player.addListener('playToEnd', () => {
      setIndex((prev) => {
        const next = prev + 1;
        if (next < entriesRef.current.length) {
          player.replace(withCookie(entriesRef.current[next].url));
          player.play();
          return next;
        }
        return prev;
      });
    });
    return () => {
      subPlay.remove();
      subTime.remove();
      subEnd.remove();
    };
  }, [player]);

  // ---- Auto-hiding controls -------------------------------------------------
  const [shown, setShown] = useState(true);
  const [interaction, setInteraction] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: shown ? 1 : 0,
      duration: shown ? 150 : 250,
      useNativeDriver: true,
    }).start();
  }, [shown, opacity]);

  // Hide a few seconds after the last interaction, but only while playing and
  // not mid-scrub.
  useEffect(() => {
    if (!shown || !isPlaying || scrub != null) return;
    const t = setTimeout(() => setShown(false), HIDE_DELAY);
    return () => clearTimeout(t);
  }, [shown, isPlaying, interaction, scrub]);

  const reveal = () => {
    setShown(true);
    setInteraction((n) => n + 1);
  };
  const bump = () => setInteraction((n) => n + 1);

  // ---- Actions --------------------------------------------------------------
  const togglePlay = () => {
    bump();
    if (isPlaying) player.pause();
    else player.play();
  };

  const onIncrementO = async () => {
    bump();
    const scene = entriesRef.current[index]?.scene;
    if (!scene) return;
    const prev = oCount;
    setOCountStore(scene.id, prev + 1); // optimistic
    try {
      const client = makeClient(server);
      const total = await incrementSceneO(client, scene.id);
      setOCountStore(scene.id, total);
    } catch {
      setOCountStore(scene.id, prev); // revert
    }
  };

  // ---- Seek bar -------------------------------------------------------------
  const fraction = scrub != null ? scrub : duration > 0 ? currentTime / duration : 0;

  const seekResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          bump();
          setScrub(clamp01(e.nativeEvent.locationX / (trackW || 1)));
        },
        onPanResponderMove: (e) => setScrub(clamp01(e.nativeEvent.locationX / (trackW || 1))),
        onPanResponderRelease: (e) => {
          const f = clamp01(e.nativeEvent.locationX / (trackW || 1));
          if (duration > 0) {
            const target = f * duration;
            player.currentTime = target;
            // Snap the displayed time straight to the target so clearing `scrub`
            // doesn't briefly fall back to the pre-seek position before the next
            // timeUpdate lands.
            setCurrentTime(target);
          }
          setScrub(null);
          bump();
        },
        onPanResponderTerminate: () => setScrub(null),
      }),
    [trackW, duration, player]
  );

  if (!playlist || entries.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={40} color="#f85149" />
        <Text style={styles.errorText}>No playable stream for this scene.</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const seekFraction = clamp01(fraction);

  return (
    <View style={styles.container}>
      <VideoView style={styles.video} player={player} contentFit="contain" nativeControls={false} />

      {/* Tap anywhere (when controls hidden) to reveal them. */}
      {!shown && <Pressable style={StyleSheet.absoluteFill} onPress={reveal} />}

      <Animated.View
        style={[styles.controls, { opacity }]}
        pointerEvents={shown ? 'auto' : 'none'}>
        {/* Scrim — tap to hide. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShown(false)} />

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconBtn}>
            <Ionicons name="chevron-down" size={28} color="#fff" />
          </Pressable>
          <View style={styles.topRight}>
            {entries.length > 1 && (
              <Text style={styles.counterText}>
                {index + 1} / {entries.length}
              </Text>
            )}
            <Pressable onPress={onIncrementO} hitSlop={10} style={styles.oButton}>
              <Ionicons name="water" size={20} color="#fff" />
              <Text style={styles.oButtonText}>{oCount}</Text>
            </Pressable>
          </View>
        </View>

        {/* Center transport */}
        <View style={styles.center}>
          <Pressable onPress={() => { bump(); player.seekBy(-10); }} hitSlop={12} style={styles.centerBtn}>
            <Ionicons name="play-back" size={30} color="#fff" />
          </Pressable>
          <Pressable onPress={togglePlay} hitSlop={12} style={styles.playBtn}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={40} color="#fff" />
          </Pressable>
          <Pressable onPress={() => { bump(); player.seekBy(10); }} hitSlop={12} style={styles.centerBtn}>
            <Ionicons name="play-forward" size={30} color="#fff" />
          </Pressable>
        </View>

        {/* Bottom seek bar */}
        <View style={styles.bottomBar}>
          <Text style={styles.time}>{fmt(seekFraction * duration)}</Text>
          <View
            style={styles.track}
            onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
            {...seekResponder.panHandlers}>
            <View style={styles.trackBg} />
            <View style={[styles.trackFill, { width: `${seekFraction * 100}%` }]} />
            <View style={[styles.thumb, { left: `${seekFraction * 100}%` }]} />
          </View>
          <Text style={styles.time}>{fmt(duration)}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  video: { flex: 1 },
  controls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  counterText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  oButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e0245e',
  },
  oButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  center: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40 },
  centerBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  time: { color: '#fff', fontSize: 12, fontVariant: ['tabular-nums'], width: 52, textAlign: 'center' },
  track: { flex: 1, height: 28, justifyContent: 'center' },
  trackBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  trackFill: {
    position: 'absolute',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e0245e',
  },
  thumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: -7,
    backgroundColor: '#fff',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: { color: '#f85149', fontSize: 15 },
  backBtn: { backgroundColor: '#e0245e', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  backText: { color: '#fff', fontWeight: '600' },
});

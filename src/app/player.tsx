import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useOCount, useSetOCount } from '@/config/OCountContext';
import { usePlayback } from '@/config/PlaybackContext';
import { useServerConfig } from '@/config/ServerConfigContext';
import { makeClient } from '@/lib/graphql';
import { fetchSceneMarkersForScene, incrementSceneO, type PlayerMarker } from '@/lib/queries';
import { withCookie } from '@/lib/session';
import { authenticatedURL } from '@/lib/stashUrl';
import type { Performer, Scene } from '@/types/stash';

const HIDE_DELAY = 3500;

type PlaylistEntry = { scene: Scene; url: string; offset: number | undefined };

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

  // Pair each playable stream with its scene (and optional marker start offset)
  // so the o-counter stays aligned and each entry resumes at the right time. We
  // keep the WHOLE loaded list (no slicing) so the position counter is absolute
  // and swipe-right can go back past the tapped scene; playback just starts at
  // the tapped entry.
  const { entries, initialIndex } = useMemo(() => {
    if (!playlist) return { entries: [] as PlaylistEntry[], initialIndex: 0 };
    const startId = playlist.scenes[playlist.startIndex]?.id;
    const all = playlist.scenes
      .map((scene, i) => ({
        scene,
        url: authenticatedURL(scene.paths.stream, server.apiKey),
        offset: playlist.offsets?.[i],
      }))
      .filter((e): e is PlaylistEntry => e.url != null);
    const start = Math.max(0, all.findIndex((e) => e.scene.id === startId));
    return { entries: all, initialIndex: start };
  }, [playlist, server.apiKey]);

  const [index, setIndex] = useState(initialIndex);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  // Mirror index so stable callbacks (the swipe gestures) can read the current
  // entry without being recreated each frame.
  const indexRef = useRef(index);
  indexRef.current = index;

  // A seek to apply once the next source has buffered (offsets land here so
  // marker entries resume at their timestamp after a player.replace), plus a
  // flag to start playback once that swapped source is ready.
  const pendingSeek = useRef<number | null>(null);
  const pendingPlay = useRef(false);

  const player = useVideoPlayer(entries[initialIndex] ? withCookie(entries[initialIndex].url) : null, (p) => {
    const t = entries[initialIndex]?.offset;
    if (t && t > 0) p.currentTime = t;
    p.timeUpdateEventInterval = 0.5;
    p.play();
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);

  // Track geometry in screen coordinates. We compute the scrub position from the
  // gesture's absolute pageX minus the track origin, NOT nativeEvent.locationX —
  // locationX is relative to whichever child (thumb/fill) the finger is over, so
  // it snaps between coordinate systems and makes the playhead flicker.
  const trackRef = useRef<View>(null);
  const trackX = useRef(0);
  const trackW = useRef(0);
  const measureTrack = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      trackX.current = x;
      trackW.current = w;
    });
  }, []);
  const fractionAt = (screenX: number) => clamp01((screenX - trackX.current) / (trackW.current || 1));

  // Mirror scrub into a ref so the timeUpdate listener (registered once) can
  // tell whether the user is mid-drag without re-subscribing.
  const scrubRef = useRef<number | null>(null);
  scrubRef.current = scrub;

  // O-count is read from / written to the shared store so increments propagate
  // back to the browse cards without a refetch.
  const setOCountStore = useSetOCount();
  const currentScene = entries[index]?.scene;
  const oCount = useOCount(currentScene?.id ?? '', currentScene?.o_counter);
  const oCountRef = useRef(oCount);
  oCountRef.current = oCount;

  // Swap to the entry at `target` (deferred seek/play via statusChange, since
  // play() right after replace() is dropped while the source buffers). Shared
  // by playToEnd auto-advance and the swipe gestures.
  const goToEntry = useCallback(
    (target: number) => {
      setIndex((prev) => {
        if (target < 0 || target >= entriesRef.current.length) return prev;
        const entry = entriesRef.current[target];
        pendingSeek.current = entry.offset && entry.offset > 0 ? entry.offset : null;
        pendingPlay.current = true;
        player.replace(withCookie(entry.url));
        return target;
      });
    },
    [player]
  );
  const goToNext = useCallback(() => goToEntry(indexRef.current + 1), [goToEntry]);
  const goToPrev = useCallback(() => goToEntry(indexRef.current - 1), [goToEntry]);

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
    const subEnd = player.addListener('playToEnd', () => goToNext());
    // Once a freshly-swapped source is ready, apply any queued offset and start
    // it playing (auto-advance).
    const subStatus = player.addListener('statusChange', (e) => {
      if (e.status !== 'readyToPlay') return;
      if (pendingSeek.current != null) {
        player.currentTime = pendingSeek.current;
        pendingSeek.current = null;
      }
      if (pendingPlay.current) {
        pendingPlay.current = false;
        player.play();
      }
    });
    return () => {
      subPlay.remove();
      subTime.remove();
      subEnd.remove();
      subStatus.remove();
    };
  }, [player, goToNext]);

  // ---- Performers / markers panel ------------------------------------------
  const [panel, setPanel] = useState<'none' | 'performers' | 'markers'>('none');
  const panelRef = useRef(panel);
  panelRef.current = panel;
  const [markers, setMarkers] = useState<PlayerMarker[]>([]);
  const [markersLoading, setMarkersLoading] = useState(false);
  // Markers fetched lazily on first open and cached per scene id.
  const markerCache = useRef<Record<string, PlayerMarker[]>>({});

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
  // not mid-scrub or browsing a panel.
  useEffect(() => {
    if (!shown || !isPlaying || scrub != null || panel !== 'none') return;
    const t = setTimeout(() => setShown(false), HIDE_DELAY);
    return () => clearTimeout(t);
  }, [shown, isPlaying, interaction, scrub, panel]);

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

  // Increment the current scene's o-count (optimistic, with revert). Stable so
  // the swipe-up gesture can call it; the button wraps it with bump().
  const incrementO = useCallback(async () => {
    const scene = entriesRef.current[indexRef.current]?.scene;
    if (!scene) return;
    const prev = oCountRef.current;
    setOCountStore(scene.id, prev + 1); // optimistic
    try {
      const client = makeClient(server);
      const total = await incrementSceneO(client, scene.id);
      setOCountStore(scene.id, total);
    } catch {
      setOCountStore(scene.id, prev); // revert
    }
  }, [server, setOCountStore]);

  const onIncrementO = () => {
    bump();
    incrementO();
  };

  const closePanel = () => {
    bump();
    setPanel('none');
  };

  const openPerformers = () => {
    bump();
    setPanel('performers');
  };

  const openMarkers = async () => {
    bump();
    const scene = entriesRef.current[indexRef.current]?.scene;
    if (!scene) return;
    setPanel('markers');
    const cached = markerCache.current[scene.id];
    if (cached) {
      setMarkers(cached);
      return;
    }
    setMarkers([]);
    setMarkersLoading(true);
    try {
      const client = makeClient(server);
      const list = await fetchSceneMarkersForScene(client, scene.id);
      markerCache.current[scene.id] = list;
      // Guard against the scene changing while the request was in flight.
      if (entriesRef.current[indexRef.current]?.scene.id === scene.id) setMarkers(list);
    } catch {
      setMarkers([]);
    } finally {
      setMarkersLoading(false);
    }
  };

  const openPerformer = (p: Performer) => {
    setPanel('none');
    router.push({ pathname: '/performer/[id]', params: { id: p.id, data: JSON.stringify(p) } });
  };

  const jumpToMarker = (seconds: number) => {
    player.currentTime = seconds;
    setCurrentTime(seconds);
    setPanel('none');
    bump();
  };

  // ---- Seek bar -------------------------------------------------------------
  const fraction = scrub != null ? scrub : duration > 0 ? currentTime / duration : 0;

  const seekResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Keep an in-progress scrub even though the root listens for swipes.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_e, g) => {
          bump();
          setScrub(fractionAt(g.x0));
        },
        onPanResponderMove: (_e, g) => setScrub(fractionAt(g.moveX)),
        onPanResponderRelease: (_e, g) => {
          const f = fractionAt(g.moveX || g.x0);
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
    [duration, player]
  );

  // ---- Swipe gestures ------------------------------------------------------
  // down: close · up: o-count + close · left: next video · right: previous.
  const SWIPE = 70;
  const gestureResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim only on a deliberate swipe so taps and buttons still work; the
        // seek bar refuses termination so scrubbing isn't stolen. Disabled while
        // a panel is open so list scrolling / taps aren't hijacked.
        onMoveShouldSetPanResponder: (_e, g) =>
          panelRef.current !== 'none'
            ? false
            : Math.abs(g.dy) > Math.abs(g.dx)
              ? Math.abs(g.dy) > 16
              : Math.abs(g.dx) > 16,
        onPanResponderRelease: (_e, g) => {
          if (Math.abs(g.dy) > Math.abs(g.dx)) {
            if (g.dy > SWIPE) {
              router.back();
            } else if (g.dy < -SWIPE) {
              incrementO();
              router.back();
            }
          } else if (g.dx < -SWIPE) {
            goToNext();
          } else if (g.dx > SWIPE) {
            goToPrev();
          }
        },
      }),
    [router, goToNext, goToPrev, incrementO]
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
    <View style={styles.container} {...gestureResponder.panHandlers}>
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
            <Pressable onPress={openPerformers} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="people" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={openMarkers} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="bookmark" size={20} color="#fff" />
            </Pressable>
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
            ref={trackRef}
            style={styles.track}
            onLayout={measureTrack}
            {...seekResponder.panHandlers}>
            <View pointerEvents="none" style={styles.trackBg} />
            <View pointerEvents="none" style={[styles.trackFill, { width: `${seekFraction * 100}%` }]} />
            <View pointerEvents="none" style={[styles.thumb, { left: `${seekFraction * 100}%` }]} />
          </View>
          <Text style={styles.time}>{fmt(duration)}</Text>
        </View>
      </Animated.View>

      {/* Performers / markers sheet — sits above the controls until dismissed. */}
      {panel !== 'none' && (
        <View style={styles.panelOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePanel} />
          <View style={styles.panelSheet}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>
                {panel === 'performers' ? 'Performers' : 'Markers'}
              </Text>
              <Pressable onPress={closePanel} hitSlop={12} style={styles.iconBtn}>
                <Ionicons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.panelList}>
              {panel === 'performers'
                ? (currentScene?.performers?.length ?? 0) === 0 ? (
                    <Text style={styles.panelEmpty}>No performers for this scene.</Text>
                  ) : (
                    (currentScene?.performers ?? []).map((p) => {
                      const img = authenticatedURL(p.image_path, server.apiKey);
                      return (
                        <Pressable key={p.id} style={styles.row} onPress={() => openPerformer(p)}>
                          {img ? (
                            <Image style={styles.avatar} source={withCookie(img)} contentFit="cover" />
                          ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                              <Ionicons name="person" size={22} color="#555" />
                            </View>
                          )}
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Ionicons name="chevron-forward" size={20} color="#8a8f94" />
                        </Pressable>
                      );
                    })
                  )
                : markersLoading ? (
                    <ActivityIndicator color="#fff" style={styles.panelSpinner} />
                  ) : markers.length === 0 ? (
                    <Text style={styles.panelEmpty}>No markers for this scene.</Text>
                  ) : (
                    markers.map((m) => (
                      <Pressable key={m.id} style={styles.row} onPress={() => jumpToMarker(m.seconds)}>
                        <Text style={styles.markerTime}>{fmt(m.seconds)}</Text>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {m.title.trim() || m.primary_tag.name}
                        </Text>
                      </Pressable>
                    ))
                  )}
            </ScrollView>
          </View>
        </View>
      )}
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
  panelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panelSheet: {
    maxHeight: '70%',
    backgroundColor: '#16171a',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingBottom: 32,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  panelTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  panelList: { paddingHorizontal: 12, paddingTop: 4 },
  panelSpinner: { paddingVertical: 28 },
  panelEmpty: { color: '#8a8f94', fontSize: 15, textAlign: 'center', paddingVertical: 28 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1a1b1e' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  markerTime: {
    color: '#e0245e',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    width: 60,
  },
});

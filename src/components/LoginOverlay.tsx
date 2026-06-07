import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { useAuthGate } from '@/config/AuthGateContext';
import { useServerConfig } from '@/config/ServerConfigContext';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Full-screen web login for proxy mode. Loads the Stash URL inside a WebView with
 * the system cookie jar enabled; the reverse proxy (Authelia, etc.) redirects to
 * its login page and back. Once we return to the Stash origin, the session cookie
 * is in the shared store and all native requests (GraphQL, images, video) carry
 * it automatically. Rendered as an absolute sibling of the router.
 */
export function LoginOverlay() {
  const { loginVisible, completeLogin, cancelLogin } = useAuthGate();
  const { serverURL } = useServerConfig();

  const sawForeignOrigin = useRef(false);
  const [currentURL, setCurrentURL] = useState<string | null>(null);

  if (!loginVisible || !serverURL) return null;

  const serverOrigin = originOf(serverURL);

  function onNavChange(nav: WebViewNavigation) {
    setCurrentURL(nav.url);
    if (nav.loading) return;
    const here = originOf(nav.url);
    if (here && here !== serverOrigin) {
      // We've been bounced to the SSO host (login page).
      sawForeignOrigin.current = true;
    } else if (here === serverOrigin && sawForeignOrigin.current) {
      // Returned to the Stash origin after authenticating → logged in.
      completeLogin();
    }
  }

  const hostLabel = currentURL ? originOf(currentURL) : serverOrigin;

  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.bar}>
          <Pressable onPress={cancelLogin} hitSlop={12} style={styles.barBtn}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.barTitle} numberOfLines={1}>
            {hostLabel ?? 'Sign in'}
          </Text>
          <Pressable onPress={completeLogin} hitSlop={12} style={styles.barBtn}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
        <WebView
          source={{ uri: serverURL }}
          onNavigationStateChange={onNavChange}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          incognito={false}
          style={styles.web}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0b',
    zIndex: 900,
  },
  safe: { flex: 1, backgroundColor: '#0a0a0b' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  barBtn: { minWidth: 50 },
  barTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  doneText: { color: '#e0245e', fontSize: 16, fontWeight: '700', textAlign: 'right' },
  web: { flex: 1, backgroundColor: '#fff' },
});

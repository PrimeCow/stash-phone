import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useAuthGate } from '@/config/AuthGateContext';
import { useServerConfig } from '@/config/ServerConfigContext';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// Reverse-proxy login pages (e.g. Authelia) often don't set autocapitalize on
// their username field, so iOS capitalizes the first letter and you can't enter a
// lowercase username. Force the right input attributes on every text field. Run
// before content loads so the MutationObserver is watching when Authelia (a SPA)
// renders the form, and re-apply on focus as a backstop.
const FIX_INPUTS_JS = `
(function() {
  try {
    function setIf(el, name, val) {
      if (el.getAttribute(name) !== val) el.setAttribute(name, val);
    }
    function fix() {
      var els = document.querySelectorAll('input, textarea');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if ((el.getAttribute('type') || '').toLowerCase() === 'password') continue;
        setIf(el, 'autocapitalize', 'none');
        setIf(el, 'autocorrect', 'off');
        setIf(el, 'spellcheck', 'false');
      }
    }
    function start() {
      fix();
      try {
        new MutationObserver(fix).observe(document.documentElement || document, {
          childList: true,
          subtree: true,
        });
      } catch (e) {}
      document.addEventListener('focusin', fix, true);
    }
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start);
  } catch (e) {}
})();
true;
`;

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

  const webRef = useRef<WebView>(null);
  const [currentURL, setCurrentURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loginVisible) return null;

  const serverOrigin = serverURL ? originOf(serverURL) : null;

  // User-controlled: sign in through the proxy + Stash pages, then tap Done.
  // The WebView's sharedCookiesEnabled keeps the session cookie available to the
  // app's native requests. No auto-detect (it false-fired on the intermediate
  // Stash login page) and no gating.
  function reload() {
    setError(null);
    webRef.current?.reload();
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
          <Pressable onPress={reload} hitSlop={12} style={styles.barBtn}>
            <Ionicons name="reload" size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={completeLogin} hitSlop={12} style={styles.barBtn}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        {!serverURL ? (
          <View style={styles.message}>
            <Text style={styles.messageText}>No server URL is configured.</Text>
          </View>
        ) : error ? (
          <View style={styles.message}>
            <Ionicons name="warning-outline" size={36} color="#f85149" />
            <Text style={styles.messageText}>Couldn’t load the login page.</Text>
            <Text style={styles.errorDetail}>{error}</Text>
            <Pressable style={styles.reloadBtn} onPress={reload}>
              <Text style={styles.reloadText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={{ uri: serverURL }}
            originWhitelist={['*']}
            onNavigationStateChange={(nav) => setCurrentURL(nav.url)}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            javaScriptEnabled
            incognito={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            onError={(e) => setError(e.nativeEvent.description || 'Network error')}
            onHttpError={(e) =>
              setError(`HTTP ${e.nativeEvent.statusCode} from ${originOf(e.nativeEvent.url) ?? 'server'}`)
            }
            onContentProcessDidTerminate={() => webRef.current?.reload()}
            injectedJavaScriptBeforeContentLoaded={FIX_INPUTS_JS}
            injectedJavaScript={FIX_INPUTS_JS}
            style={styles.web}
          />
        )}
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
  barBtn: { minWidth: 36, alignItems: 'center' },
  barTitle: { flex: 1, color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  doneText: { color: '#e0245e', fontSize: 16, fontWeight: '700', textAlign: 'right' },
  web: { flex: 1, backgroundColor: '#fff' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0b',
  },
  message: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  messageText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  errorDetail: { color: '#8a8f94', fontSize: 13, textAlign: 'center' },
  reloadBtn: { backgroundColor: '#e0245e', paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 },
  reloadText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

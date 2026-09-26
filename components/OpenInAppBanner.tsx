import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import QRCode from 'qrcode';
import { Smartphone, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

// "Open in app" prompt for the web build. On a phone browser it hands the
// current screen to Expo Go; on a desktop browser it shows a QR code the phone
// can scan (public/open.html does the hand-off there). Renders nothing natively.
//
// The link is built from the page's own address: Metro serves the web app and
// the Expo Go manifest from the same host (the Cloudflare tunnel, Funnel, or
// the tailnet IP), so exps://<host> (https) / exp://<host> (http) always points
// at the dev server that served this page. "/--/<path>" makes Expo Go open
// that route after loading the project.
//
// EXPO_PUBLIC_APP_LINK_MODE=native switches to the app's own scheme
// (travelbuddy://<path>, app.json "scheme") for dev/store builds.

const DISMISS_KEY = 'tb.openInApp.dismissedAt';
const DISMISS_DAYS = 7;
const STORE_LINKS = {
  ios: 'https://apps.apple.com/app/expo-go/id982107779',
  android: 'https://play.google.com/store/apps/details?id=host.exp.exponent',
};

type MobileOs = 'ios' | 'android' | null;

export function getAppLink(path?: string): string {
  const target = path ?? window.location.pathname + window.location.search;
  if (process.env.EXPO_PUBLIC_APP_LINK_MODE === 'native') {
    return `travelbuddy://${target.replace(/^\//, '')}`;
  }
  const scheme = window.location.protocol === 'https:' ? 'exps' : 'exp';
  return `${scheme}://${window.location.host}/--${target.startsWith('/') ? target : `/${target}`}`;
}

// Link for a phone to scan: public/open.html on this host, which opens Expo Go at `path`.
export function getOpenPageLink(path?: string): string {
  const target = path ?? window.location.pathname + window.location.search;
  return `${window.location.origin}/open.html?to=${encodeURIComponent(target)}`;
}

function detectMobileOs(): MobileOs {
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return null;
}

function dismissedRecently(): boolean {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode): the banner just comes back next visit.
  }
}

function QrCode({ value, size, color, background }: { value: string; size: number; color: string; background: string }) {
  const { path, count } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.get(x, y)) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { path: d, count: n };
  }, [value]);
  const quiet = 2;
  return (
    <Svg width={size} height={size} viewBox={`${-quiet} ${-quiet} ${count + quiet * 2} ${count + quiet * 2}`}>
      <Rect x={-quiet} y={-quiet} width={count + quiet * 2} height={count + quiet * 2} fill={background} />
      <Path d={path} fill={color} />
    </Svg>
  );
}

export default function OpenInAppBanner() {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [os, setOs] = useState<MobileOs>(null);
  const [showStores, setShowStores] = useState(false);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (dismissedRecently()) return;
    setOs(detectMobileOs());
    setVisible(true);
    return () => {
      if (fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    rememberDismissed();
    setVisible(false);
  };

  const openInApp = () => {
    setShowStores(false);
    // If the app opens, the browser tab goes to the background. Still visible
    // after a moment means nothing handled the link: offer the store instead.
    const onHide = () => {
      if (document.hidden && fallbackTimer.current) clearTimeout(fallbackTimer.current);
    };
    document.addEventListener('visibilitychange', onHide, { once: true });
    fallbackTimer.current = setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      if (!document.hidden) setShowStores(true);
    }, 1500);
    window.location.href = getAppLink();
  };

  const colors = theme.colors;

  // ── Desktop: scan with the phone ──────────────────────────────────────────
  if (!os) {
    return (
      <View style={[styles.card, styles.desktopCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.qrBox}>
          <QrCode value={getOpenPageLink()} size={112} color="#111827" background="#FFFFFF" />
        </View>
        <View style={styles.desktopText}>
          <Text style={[styles.title, { color: colors.text }]}>Use TravelBuddy on your phone</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Scan with your phone camera to open this screen in Expo Go.
          </Text>
        </View>
        <TouchableOpacity onPress={dismiss} accessibilityLabel="Dismiss" hitSlop={8} style={styles.close}>
          <X size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Phone browser: hand off to the app ────────────────────────────────────
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.primary }]}>
          <Smartphone size={20} color="#FFFFFF" />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.title, { color: colors.text }]}>TravelBuddy works best in the app</Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>Opens this screen in Expo Go.</Text>
        </View>
        <TouchableOpacity onPress={dismiss} accessibilityLabel="Dismiss" hitSlop={8} style={styles.close}>
          <X size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={openInApp}
        accessibilityRole="link"
      >
        <Text style={styles.buttonText}>Open in app</Text>
      </TouchableOpacity>

      {showStores && (
        <View style={styles.fallback}>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            Didn't open? Install Expo Go, then tap "Open in app" again.
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL(STORE_LINKS[os])}>
            <Text style={[styles.link, { color: colors.primary }]}>
              {os === 'ios' ? 'Get Expo Go on the App Store' : 'Get Expo Go on Google Play'}
            </Text>
          </TouchableOpacity>
          {os === 'ios' && (
            <Text style={[styles.note, { color: colors.textSecondary }]}>
              On iPhone, sign in to Expo Go with the project's Expo account first.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    gap: 12,
  },
  desktopCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: { flex: 1 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBox: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  desktopText: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 13, lineHeight: 18 },
  close: { alignSelf: 'flex-start', padding: 2 },
  button: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  fallback: { gap: 6 },
  link: { fontSize: 14, fontWeight: '600' },
  note: { fontSize: 12, fontStyle: 'italic' },
});

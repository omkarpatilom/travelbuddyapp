import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Share2, Radio, EyeOff, X, Check, Copy } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { confirmAction, notify } from '@/utils/dialog';
import { useOperation, useOperationPending } from '@/hooks/mutations/operations';
import { useActiveShareLinkQuery, createShareLinkOp, disableShareLinkOp } from '@/hooks/useTripShare';
import {
  shareService,
  shareTripLink,
  copyTripLink,
  isShareableBooking,
  NICKNAME_MAX_LENGTH,
  type ShareNameDisplay,
} from '@/services/share.service';

interface Props {
  rideId: string;
  bookingId: string;
  bookingStatus?: string | null;
}

const NAME_OPTIONS: { value: ShareNameDisplay; label: string; hint: string }[] = [
  { value: 'FirstNameInitial', label: 'First name + initial', hint: 'e.g. "Ravi K."' },
  { value: 'Nickname', label: 'A nickname', hint: 'e.g. "Mom" or "Aai"' },
  { value: 'Hidden', label: 'Hide my name', hint: 'Shown as "a TravelBuddy trip"' },
];

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Short-lived confirmation shown under the buttons (Alert.alert is a no-op on web). */
type Notice = { kind: 'success' | 'info'; text: string } | null;

/**
 * Lets a passenger share a live, read-only tracking link for their trip with
 * family or friends, choose how their name appears, and turn it off.
 */
export default function TripShareCard({ rideId, bookingId, bookingStatus }: Props) {
  const { theme } = useTheme();
  const shareable = isShareableBooking(bookingStatus);
  const activeQuery = useActiveShareLinkQuery(bookingId, shareable);
  const active = activeQuery.data ?? null;

  const { run: runCreate } = useOperation(createShareLinkOp);
  const { run: runDisable } = useOperation(disableShareLinkOp);
  const isCreating = useOperationPending('createShareLink', bookingId);
  const isDisabling = useOperationPending('disableShareLink', active?.linkId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [nameDisplay, setNameDisplay] = useState<ShareNameDisplay>('FirstNameInitial');
  const [nickname, setNickname] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  if (!shareable) return null;

  const showNotice = (next: Notice) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(next);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const share = async (url: string) => {
    try {
      const outcome = await shareTripLink(url);
      if (outcome === 'copied') {
        showNotice({ kind: 'success', text: 'Message and link copied — paste it into WhatsApp, SMS or email.' });
      }
    } catch {
      // Sharing unavailable: copying still gets the link to them.
      await copy(url);
    }
  };

  const copy = async (url: string) => {
    try {
      await copyTripLink(url);
      showNotice({ kind: 'success', text: 'Link copied.' });
    } catch {
      notify('Your tracking link', url);
    }
  };

  /** The link is shown once by the server; this device may not have it. */
  const withCurrentUrl = async (action: (url: string) => Promise<void>) => {
    if (!active) return;
    const url = await shareService.getCachedUrl(bookingId, active.linkId);
    if (url) {
      await action(url);
      return;
    }
    const replace = await confirmAction(
      'Create a new link?',
      "This device doesn't have your current link. A new link will be created and the old one will stop working.",
      'Create new link',
    );
    if (replace) {
      setNameDisplay(active.nameDisplay);
      setNickname(active.nameDisplay === 'Nickname' ? active.displayName ?? '' : '');
      setSheetOpen(true);
    }
  };

  const nicknameMissing = nameDisplay === 'Nickname' && nickname.trim().length === 0;

  const handleCreate = async () => {
    if (nicknameMissing) return;
    try {
      const result = await runCreate({ rideId, bookingId, nameDisplay, nickname });
      if (!result) return;
      setSheetOpen(false);
      await share(result.data.url);
    } catch (e: any) {
      notify('Could not create link', e?.message || 'Please try again.');
    }
  };

  const handleTurnOff = async () => {
    if (!active) return;
    const confirmed = await confirmAction(
      'Turn off sharing?',
      'People with the link will see that sharing was turned off.',
      'Turn off',
      true,
    );
    if (!confirmed) return;
    try {
      await runDisable({ linkId: active.linkId, bookingId });
    } catch (e: any) {
      notify('Could not turn off sharing', e?.message || 'Please try again.');
    }
  };

  const nameSummary = active
    ? active.displayName
      ? `Shown as "${active.displayName}"`
      : 'Your name is hidden'
    : '';

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} testID="trip-share-card">
      <View style={styles.headerRow}>
        <Share2 size={18} color={theme.colors.primary} />
        <Text style={[styles.title, { color: theme.colors.text }]}>Share trip live</Text>
        {active && (
          <View style={[styles.liveBadge, { backgroundColor: theme.colors.success + '20' }]}>
            <Radio size={12} color={theme.colors.success} />
            <Text style={[styles.liveText, { color: theme.colors.success }]}>Sharing on</Text>
          </View>
        )}
      </View>

      {activeQuery.isPending ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 8 }} />
      ) : active ? (
        <>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
            Family and friends with the link can follow this trip on a map until you're dropped off. Ends by {formatTime(active.expiresAt)}.
          </Text>
          <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>{nameSummary}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
              onPress={() => withCurrentUrl(share)}
              disabled={isDisabling}
              accessibilityLabel="Share tracking link again"
            >
              <Share2 size={16} color="#FFFFFF" />
              <Text style={styles.primaryText}>Share link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: theme.colors.border }]}
              onPress={() => withCurrentUrl(copy)}
              disabled={isDisabling}
              accessibilityLabel="Copy tracking link"
            >
              <Copy size={16} color={theme.colors.text} />
              <Text style={[styles.secondaryText, { color: theme.colors.text }]}>Copy link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: '#EF4444' }]}
              onPress={handleTurnOff}
              disabled={isDisabling}
              accessibilityLabel="Turn off trip sharing"
            >
              {isDisabling ? <ActivityIndicator size="small" color="#EF4444" /> : <EyeOff size={16} color="#EF4444" />}
              <Text style={[styles.secondaryText, { color: '#EF4444' }]}>{isDisabling ? 'Turning off…' : 'Turn off'}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
            Send a link so family or friends can follow your ride on a map — no app or login needed. It stops working when you're dropped off.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.colors.primary, alignSelf: 'flex-start', opacity: isCreating ? 0.7 : 1 }]}
            onPress={() => setSheetOpen(true)}
            disabled={isCreating}
            accessibilityLabel="Share trip"
          >
            {isCreating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Share2 size={16} color="#FFFFFF" />}
            <Text style={styles.primaryText}>{isCreating ? 'Creating link…' : 'Share trip'}</Text>
          </TouchableOpacity>
        </>
      )}

      {notice && (
        <View
          style={[styles.notice, { backgroundColor: theme.colors.success + '18', borderColor: theme.colors.success }]}
          accessibilityLiveRegion="polite"
        >
          <Check size={14} color={theme.colors.success} />
          <Text style={[styles.noticeText, { color: theme.colors.text }]}>{notice.text}</Text>
        </View>
      )}

      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: theme.colors.card }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>How should your name appear?</Text>
              <TouchableOpacity onPress={() => setSheetOpen(false)} accessibilityLabel="Close">
                <X size={20} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              Viewers see the driver, vehicle, live location and ETA. Your phone number is never shown.
            </Text>

            {NAME_OPTIONS.map((option) => {
              const selected = nameDisplay === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, { borderColor: selected ? theme.colors.primary : theme.colors.border }]}
                  onPress={() => setNameDisplay(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.radio, { borderColor: selected ? theme.colors.primary : theme.colors.border }]}>
                    {selected && <Check size={12} color={theme.colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionLabel, { color: theme.colors.text }]}>{option.label}</Text>
                    <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>{option.hint}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {nameDisplay === 'Nickname' && (
              <TextInput
                value={nickname}
                onChangeText={setNickname}
                placeholder="Nickname"
                placeholderTextColor={theme.colors.textSecondary}
                maxLength={NICKNAME_MAX_LENGTH}
                autoFocus
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
                accessibilityLabel="Nickname"
              />
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, styles.createBtn, { backgroundColor: theme.colors.primary, opacity: nicknameMissing || isCreating ? 0.5 : 1 }]}
              onPress={handleCreate}
              disabled={nicknameMissing || isCreating}
              accessibilityLabel="Create and share link"
            >
              {isCreating ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Share2 size={16} color="#FFFFFF" />}
              <Text style={styles.primaryText}>{isCreating ? 'Creating link…' : 'Create & share link'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700', flex: 1 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  liveText: { fontSize: 12, fontWeight: '600' },
  body: { fontSize: 13, lineHeight: 19 },
  meta: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  primaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  secondaryText: { fontWeight: '600', fontSize: 14 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  createBtn: { marginTop: 4 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  noticeText: { fontSize: 13, flex: 1 },
});

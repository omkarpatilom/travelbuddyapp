import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { api } from '../utils/api';
import { storage } from '../utils/storage';

/** How the passenger's name appears on the public tracking page. */
export type ShareNameDisplay = 'FirstNameInitial' | 'Nickname' | 'Hidden';

export interface ShareLinkCreated {
  linkId: string;
  token: string;
  url: string;
  expiresAt: string;
  nameDisplay: ShareNameDisplay;
  displayName: string | null;
}

export interface ActiveShareLink {
  linkId: string;
  rideId: string;
  bookingId: string | null;
  expiresAt: string;
  nameDisplay: ShareNameDisplay;
  displayName: string | null;
}

/** Booking statuses (as mapped by the app) in which a passenger can share. */
export const SHAREABLE_BOOKING_STATUSES = ['confirmed', 'readyforboarding', 'boarded', 'inride', 'readyfordrop'];

export const isShareableBooking = (status?: string | null) =>
  SHAREABLE_BOOKING_STATUSES.includes((status || '').toLowerCase());

export const NICKNAME_MAX_LENGTH = 30;

/**
 * The server only returns the link once, at creation; it keeps a hash. The app
 * remembers it per booking so "Share again" works. Cleared on sign-out with
 * the rest of local storage.
 */
const urlKey = (bookingId: string) => `tripShareLink:${bookingId}`;

interface CachedLink {
  linkId: string;
  url: string;
}

export const shareService = {
  async createLink(rideId: string, bookingId: string, nameDisplay: ShareNameDisplay, nickname?: string) {
    const created = await api.post<ShareLinkCreated>(`/rides/${rideId}/bookings/${bookingId}/share-links`, {
      nameDisplay,
      nickname: nameDisplay === 'Nickname' ? (nickname || '').trim() : undefined,
    });
    await storage.setItem(urlKey(bookingId), { linkId: created.linkId, url: created.url } satisfies CachedLink);
    return created;
  },

  /** The booking's viewable link, or null (the API answers 204 when there is none). */
  async getActiveLink(bookingId: string): Promise<ActiveShareLink | null> {
    const result = await api.get<ActiveShareLink | Record<string, never>>(
      `/rides/share-links/active?bookingId=${encodeURIComponent(bookingId)}`,
    );
    return result && 'linkId' in result && result.linkId ? (result as ActiveShareLink) : null;
  },

  async disableLink(linkId: string, bookingId: string) {
    await api.delete(`/rides/share-links/${linkId}`);
    await storage.removeItem(urlKey(bookingId));
  },

  /** The remembered URL, only if it belongs to the given (still active) link. */
  async getCachedUrl(bookingId: string, linkId: string): Promise<string | null> {
    const cached = await storage.getItem<CachedLink>(urlKey(bookingId));
    return cached && cached.linkId === linkId ? cached.url : null;
  },
};

export const SHARE_TITLE = 'Follow my TravelBuddy trip';

/** Text that goes with the link; the link itself is added by {@link shareMessage}. */
export const SHARE_TEXT =
  "I'm on a TravelBuddy ride 🚗 You can follow my trip live — driver, vehicle, live location and ETA. " +
  "No app or login needed; the link stops working once I've been dropped off.";

export const shareMessage = (url: string) => `${SHARE_TEXT}\n\n${url}`;

export type ShareOutcome = 'shared' | 'copied' | 'dismissed';

/** Copies the tracking link. Works on iOS, Android and web. */
export async function copyTripLink(url: string): Promise<void> {
  await Clipboard.setStringAsync(url);
}

/**
 * Opens the system share sheet. On web, React Native's Share needs the Web
 * Share API, which most desktop browsers lack; there the link is copied
 * instead so the user can paste it anywhere.
 */
export async function shareTripLink(url: string): Promise<ShareOutcome> {
  if (Platform.OS === 'web') {
    const nav: any = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
        return 'shared';
      } catch (e: any) {
        if (e?.name === 'AbortError') return 'dismissed';
        // Not allowed here (e.g. insecure context): fall back to copying.
      }
    }
    await copyTripLink(shareMessage(url));
    return 'copied';
  }

  const result = await Share.share({ title: SHARE_TITLE, message: shareMessage(url) });
  return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
}

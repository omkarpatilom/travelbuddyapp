import React from 'react';
import { render as rtlRender, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TripShareCard from '../components/TripShareCard';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../utils/api';
import { confirmAction } from '../utils/dialog';
import { __resetOperations } from '../hooks/mutations/operations';
import * as Clipboard from 'expo-clipboard';
import { shareService, shareTripLink, SHARE_TEXT, SHARE_TITLE } from '../services/share.service';

jest.mock('../contexts/ThemeContext');
jest.mock('../utils/api');
jest.mock('../utils/dialog', () => ({ confirmAction: jest.fn(), notify: jest.fn() }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn().mockResolvedValue(true) }));

const theme = {
  colors: { primary: '#00f', background: '#fff', surface: '#fff', card: '#fafafa', border: '#eee', text: '#000', textSecondary: '#666', success: '#0a0' },
};

const render = (ui: React.ReactElement) =>
  rtlRender(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>,
  );

// resetAllMocks would also wipe the AsyncStorage mock, so reset only these.
const resetApiMocks = () => {
  jest.clearAllMocks();
  (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(true);
  [api.get, api.post, api.delete, confirmAction].forEach((fn) => (fn as jest.Mock).mockReset());
};

const active = {
  linkId: 'link-1', rideId: 'ride-1', bookingId: 'b-1', expiresAt: '2026-09-25T18:00:00Z',
  nameDisplay: 'Nickname', displayName: 'Aai',
};

describe('TripShareCard', () => {
  beforeEach(async () => {
    resetApiMocks();
    __resetOperations();
    await AsyncStorage.clear();
    (useTheme as jest.Mock).mockReturnValue({ theme });
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
  });

  it('is hidden for bookings that cannot be shared', () => {
    const { queryByTestId } = render(<TripShareCard rideId="ride-1" bookingId="b-1" bookingStatus="pending" />);
    expect(queryByTestId('trip-share-card')).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('creates a link with a nickname and opens the share sheet', async () => {
    (api.get as jest.Mock).mockResolvedValue({}); // 204: no active link
    (api.post as jest.Mock).mockResolvedValue({
      linkId: 'link-1', token: 't', url: 'https://track.example/t/abc', expiresAt: active.expiresAt,
      nameDisplay: 'Nickname', displayName: 'Aai',
    });

    const { findByLabelText, getByText, getByLabelText, findByText } = render(
      <TripShareCard rideId="ride-1" bookingId="b-1" bookingStatus="confirmed" />,
    );
    fireEvent.press(await findByLabelText('Share trip'));
    fireEvent.press(getByText('A nickname'));
    expect(getByLabelText('Create and share link')).toBeDisabled();
    fireEvent.changeText(getByLabelText('Nickname'), ' Aai ');
    fireEvent.press(getByLabelText('Create and share link'));

    await waitFor(() => expect(Share.share).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/rides/ride-1/bookings/b-1/share-links', { nameDisplay: 'Nickname', nickname: 'Aai' });
    const shared = (Share.share as jest.Mock).mock.calls[0][0];
    expect(shared.title).toBe(SHARE_TITLE);
    expect(shared.message).toContain(SHARE_TEXT);
    expect(shared.message).toContain('https://track.example/t/abc');
    expect(await findByText('Sharing on')).toBeTruthy();
    expect(await findByText('Shown as "Aai"')).toBeTruthy();
  });

  it('shares the remembered link again without creating a new one', async () => {
    (api.get as jest.Mock).mockResolvedValue(active);
    await AsyncStorage.setItem('tripShareLink:b-1', JSON.stringify({ linkId: 'link-1', url: 'https://track.example/t/remembered' }));

    const { findByLabelText } = render(<TripShareCard rideId="ride-1" bookingId="b-1" bookingStatus="boarded" />);
    fireEvent.press(await findByLabelText('Share tracking link again'));

    await waitFor(() => expect(Share.share).toHaveBeenCalled());
    expect(JSON.stringify((Share.share as jest.Mock).mock.calls[0][0])).toContain('/t/remembered');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('copies the link and confirms inline', async () => {
    (api.get as jest.Mock).mockResolvedValue(active);
    await AsyncStorage.setItem('tripShareLink:b-1', JSON.stringify({ linkId: 'link-1', url: 'https://track.example/t/remembered' }));

    const { findByLabelText, findByText } = render(<TripShareCard rideId="ride-1" bookingId="b-1" bookingStatus="boarded" />);
    fireEvent.press(await findByLabelText('Copy tracking link'));

    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://track.example/t/remembered'));
    expect(await findByText('Link copied.')).toBeTruthy();
  });

  it('turns sharing off after confirmation', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce(active).mockResolvedValue({});
    (api.delete as jest.Mock).mockResolvedValue({});
    (confirmAction as jest.Mock).mockResolvedValue(true);

    const { findByLabelText, findByLabelText: find } = render(<TripShareCard rideId="ride-1" bookingId="b-1" bookingStatus="boarded" />);
    fireEvent.press(await findByLabelText('Turn off trip sharing'));

    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/rides/share-links/link-1'));
    expect(await find('Share trip')).toBeTruthy();
  });
});

describe('shareService', () => {
  beforeEach(async () => {
    resetApiMocks();
    await AsyncStorage.clear();
  });

  it('treats a 204 (empty body) as no active link', async () => {
    (api.get as jest.Mock).mockResolvedValue({});
    await expect(shareService.getActiveLink('b-1')).resolves.toBeNull();
    expect(api.get).toHaveBeenCalledWith('/rides/share-links/active?bookingId=b-1');
  });

  it('only returns the cached URL for the matching link', async () => {
    (api.post as jest.Mock).mockResolvedValue({ linkId: 'new', url: 'https://x/t/1' });
    await shareService.createLink('r', 'b-2', 'Hidden');
    expect(api.post).toHaveBeenCalledWith('/rides/r/bookings/b-2/share-links', { nameDisplay: 'Hidden', nickname: undefined });
    await expect(shareService.getCachedUrl('b-2', 'new')).resolves.toBe('https://x/t/1');
    await expect(shareService.getCachedUrl('b-2', 'other')).resolves.toBeNull();
  });
});

describe('shareTripLink on web', () => {
  const { Platform } = require('react-native');
  const originalOS = Platform.OS;
  const g = global as any;
  const originalNavigator = g.navigator;
  // The React Native test environment has no browser navigator.
  const nav: any = {};

  beforeEach(() => {
    Platform.OS = 'web';
    g.navigator = nav;
    (Clipboard.setStringAsync as jest.Mock).mockClear().mockResolvedValue(true);
  });
  afterEach(() => {
    Platform.OS = originalOS;
    g.navigator = originalNavigator;
    delete nav.share;
  });

  it('uses the Web Share API when the browser has it', async () => {
    nav.share = jest.fn().mockResolvedValue(undefined);
    await expect(shareTripLink('https://x/t/1')).resolves.toBe('shared');
    expect(nav.share).toHaveBeenCalledWith({ title: SHARE_TITLE, text: SHARE_TEXT, url: 'https://x/t/1' });
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });

  it('copies the message and link when the browser cannot share (desktop)', async () => {
    nav.share = undefined;
    await expect(shareTripLink('https://x/t/1')).resolves.toBe('copied');
    const copied = (Clipboard.setStringAsync as jest.Mock).mock.calls[0][0];
    expect(copied).toContain(SHARE_TEXT);
    expect(copied).toContain('https://x/t/1');
  });

  it('treats a cancelled share sheet as dismissed', async () => {
    nav.share = jest.fn().mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    await expect(shareTripLink('https://x/t/1')).resolves.toBe('dismissed');
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
  });
});

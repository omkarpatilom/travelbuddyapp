import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert() is a documented no-op (it renders nothing
// and never calls any button's onPress), which silently broke every
// confirm-gated action on web -- most critically, a driver could never
// accept a pending booking on web at all, since that action only ran inside
// an Alert.alert button callback. window.confirm()/window.alert() are the
// standard cross-platform substitutes; native keeps the real Alert.alert.
export const confirmAction = (
  title: string,
  message: string,
  confirmLabel: string = 'OK',
  destructive: boolean = false,
): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
};

export const notify = (title: string, message: string): void => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

// Complete the auth session if redirected back to the app (for Web and Expo platforms)
WebBrowser.maybeCompleteAuthSession();

export const googleAuthHelper = {
  async startGoogleAuth(): Promise<string> {
    const clientId = '196998021070-sjvh5aou2irldo9m93lfrn89ojq4e46a.apps.googleusercontent.com';
    const googleRedirectUri = 'https://auth.expo.io/@omkarpatilom/travelbuddyapp';
    
    // Create deep link redirect back to the app (e.g. travelbuddy://auth/google-callback)
    const appRedirectUrl = Linking.createURL('auth/google-callback');
    
    // Generate a simple secure random nonce
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Construct the Google OAuth request
    const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + 
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(googleRedirectUri)}` +
      `&response_type=id_token` +
      `&scope=${encodeURIComponent('openid email profile')}` +
      `&nonce=${nonce}`;

    // Route through Expo proxy so Google Console validation passes, then redirects back to our app
    const proxyUrl = `https://auth.expo.io/@omkarpatilom/travelbuddyapp/start?` +
      `authUrl=${encodeURIComponent(authUrl)}` +
      `&returnUrl=${encodeURIComponent(appRedirectUrl)}`;

    console.log('Starting Google Auth via Expo proxy:', proxyUrl);
    console.log('Local App Return URL:', appRedirectUrl);

    const result = await WebBrowser.openAuthSessionAsync(proxyUrl, appRedirectUrl);
    
    if (result.type === 'success' && result.url) {
      const parsedUrl = Linking.parse(result.url);
      let idToken = parsedUrl.queryParams?.id_token as string;
      
      // Hash parameters mapping fallback (OAuth 2.0 implicit returns params in hash fragment)
      if (!idToken && result.url.includes('#')) {
        const hash = result.url.split('#')[1];
        // Parse hash params safely in React Native
        const parts = hash.split('&');
        for (const part of parts) {
          const [key, val] = part.split('=');
          if (key === 'id_token') {
            idToken = decodeURIComponent(val);
            break;
          }
        }
      }

      if (idToken) {
        return idToken;
      }
      throw new Error('Google authentication succeeded but did not return an identity token.');
    }
    
    throw new Error('Google authentication cancelled or closed.');
  }
};

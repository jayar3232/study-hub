import { Linking } from 'react-native';

const MAIN_APP_DEEP_LINK = 'syncrova://open/dashboard';
const MAIN_WEB_FALLBACK = 'https://study-hub-two-sandy.vercel.app/dashboard';

export const openMainSyncrova = async () => {
  try {
    await Linking.openURL(MAIN_APP_DEEP_LINK);
    return true;
  } catch {
    try {
      await Linking.openURL(MAIN_WEB_FALLBACK);
      return true;
    } catch {
      return false;
    }
  }
};

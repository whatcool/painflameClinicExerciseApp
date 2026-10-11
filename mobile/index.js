/**
 * @format
 */

// Must come first: provides crypto.getRandomValues for PIN salts.
import 'react-native-get-random-values';
// Needed by the Supabase client on React Native.
import 'react-native-url-polyfill/auto';
import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

import { registerRootComponent } from 'expo';

import App from './App';

// The video calling SDK is loaded lazily in components/VideoRoom.tsx, because importing
// native video modules at startup crashes Expo Go (no native video module there).

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

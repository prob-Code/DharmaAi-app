import { registerRootComponent } from 'expo';

import App from './App';

// LiveKit's registerGlobals() is called lazily in components/VideoRoom.tsx, because
// importing WebRTC at startup crashes Expo Go (no native WebRTC module there).

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

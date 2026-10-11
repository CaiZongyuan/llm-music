const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

// The approved first release connects to an explicitly paired LAN HTTP server.
// This setting belongs to the app's own binary; Expo Go has separate networking config.
module.exports = function withAndroidLan(config) {
  return withAndroidManifest(config, (result) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults);
    application.$['android:usesCleartextTraffic'] = 'true';
    return result;
  });
};

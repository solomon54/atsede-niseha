const { existsSync } = require("node:fs");
const { join } = require("node:path");

/**
 * Expo config wrapper.
 *
 * FCM needs an Android `google-services.json` from the Firebase project. The
 * file is environment-specific and not committed, so we reference it only when
 * it is actually present — otherwise `expo run:android` / EAS builds fail with
 * a missing-file error even though the rest of the app builds fine.
 *
 * Drop the file at `mobile/google-services.json` (Firebase console →
 * Project settings → Your apps → Android app `org.atsedeniseha.app`) to enable
 * push notifications.
 */
module.exports = ({ config }) => {
  const hasGoogleServices = existsSync(join(__dirname, "google-services.json"));

  return {
    ...config,
    android: {
      ...config.android,
      ...(hasGoogleServices
        ? { googleServicesFile: "./google-services.json" }
        : {}),
    },
  };
};

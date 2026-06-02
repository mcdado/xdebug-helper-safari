# Safari

The extension runs in Safari as-is. Safari supports the `chrome.*` namespace with both callbacks and promises, and every API and manifest key used here is supported (`runtime.setUninstallURL` exists but is a no-op). No Safari-specific code or manifest changes are needed.

Safari does not install a bare extension directory for everyday use; distribution requires an Apple app wrapper. The steps below cover local testing and packaging on a current macOS (Safari 26 or later).

## Run locally (no Xcode required)

1. Safari > Settings > Advanced: enable "Show features for web developers" so the Develop menu appears.
2. Develop > Developer Settings…, then click "Add Temporary Extension…" and select the `src/` folder (the one containing `manifest.json`). Confirm the unsigned-extension prompt if asked.
3. Safari switches to the Extensions tab and lists the extension under "Temporary". Use "Reload" there after editing files.
4. Content scripts only run on a site after you allow the extension for it (click the extension's toolbar icon and grant access to the site, or to all websites).

Temporary extensions are removed when Safari quits or after 24 hours.

## Package for TestFlight / App Store (no Xcode required)

1. Build the extension package:

   ```sh
   ./build.sh
   ```

   This produces `build/xdebug-helper@<version>.zip` (the same package used for Chrome: `src/` plus `LICENSE`).
2. In App Store Connect, create an app record (macOS, iOS, or both) with a bundle identifier owned by your Apple Developer account.
3. Go to Users and Access > Xcode Cloud > Safari Web Extension Packager, click Upload and select the zip. The packager uses Xcode Cloud compute to build a signed app plus extension bundle.
4. Test the build with TestFlight, then submit it for App Store review.

Reference: https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect

## Package with Xcode (optional)

With full Xcode installed and selected (`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`; the Command Line Tools alone do not include the packager):

```sh
xcrun safari-web-extension-packager ./src \
    --project-location ./Safari \
    --app-name "Xdebug Helper" \
    --bundle-identifier com.example.xdebug-helper \
    --copy-resources
```

The tool was previously named `safari-web-extension-converter`. The generated Xcode project builds the app that installs the extension in Safari, and can be archived and uploaded to App Store Connect in the usual way.

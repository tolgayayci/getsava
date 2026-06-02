/**
 * Config plugin: make Expo SDK 56 compile under Xcode 26 / Swift 6.2.
 *
 * Expo SDK 56 targets Xcode 26.4; on Xcode 26.0–26.3 the Swift 6.2 compiler is
 * stricter and rejects Expo's `weak` stored properties with:
 *   - "weak must be a mutable variable" (weak var inside Sendable/actor/~Copyable), and
 *   - "stored property of a Sendable class is mutable".
 * These come from Swift 6 *strict concurrency* checking.
 *
 * Fixes, applied together so they survive every `expo prebuild`:
 *
 *  A. EXPO_USE_PRECOMPILED_MODULES=false — build Expo pods from source so the
 *     build settings below actually reach them (the shipped xcframeworks ignore
 *     them). Handled in Podfile.properties.json (see withNoPrecompiled).
 *
 *  B. post_install: for every Expo / EX / expo-* / ReactNativePasskeys pod
 *     target, downgrade Swift language mode to 5.0 and disable strict
 *     concurrency. Swift 5 mode + minimal concurrency turns the `weak`/Sendable
 *     errors into warnings. (No Expo pod except expo-modules-jsi uses a Swift
 *     regex literal, so Swift-5 mode is safe here; JSI is handled separately by
 *     a pnpm patch + its own xcframework build and is NOT downgraded.)
 *
 *  C. The lone `weak let` declarations (which no build flag can fix) are handled
 *     by pnpm patches on expo-modules-jsi and expo-modules-core.
 */
const { withDangerousMod, withPodfileProperties } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const MARKER = '# getsava:expo-xcode26-swift';

// Pods whose Swift sources need the relaxed settings. Prefix match.
const EXPO_PREFIXES = ['Expo', 'EX', 'ReactNativePasskeys', 'expo-'];
// expo-modules-jsi builds via its own xcframework toolchain (pnpm-patched);
// leave its language mode untouched so its Swift regex literal keeps working.
const SKsIP = ['ExpoModulesJSI'];

const SNIPPET = `
  post_install do |installer|
    ${MARKER}
    expo_prefixes = ['Expo', 'EX', 'ReactNativePasskeys', 'expo-']
    skip = ['ExpoModulesJSI']
    installer.pods_project.targets.each do |target|
      next if skip.include?(target.name)
      next unless expo_prefixes.any? { |p| target.name.start_with?(p) }
      target.build_configurations.each do |config|
        config.build_settings['SWIFT_VERSION'] = '5.0'
        config.build_settings['SWIFT_STRICT_CONCURRENCY'] = 'minimal'
        config.build_settings['SWIFT_APPROACHABLE_CONCURRENCY'] = 'NO'
        config.build_settings['SWIFT_DEFAULT_ACTOR_ISOLATION'] = 'nonisolated'
      end
    end
  end
`;

function patchPodfile(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }
  const lastEnd = contents.lastIndexOf('\nend');
  if (lastEnd === -1) {
    return `${contents}\n${SNIPPET}`;
  }
  return `${contents.slice(0, lastEnd)}\n${SNIPPET}${contents.slice(lastEnd)}`;
}

const withPodfilePatch = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const original = fs.readFileSync(podfilePath, 'utf8');
      fs.writeFileSync(podfilePath, patchPodfile(original));
      return cfg;
    },
  ]);

const withNoPrecompiled = (config) =>
  withPodfileProperties(config, (cfg) => {
    cfg.modResults.EXPO_USE_PRECOMPILED_MODULES = 'false';
    return cfg;
  });

// Exported constants kept for readability/reference (not used at runtime by the
// embedded Ruby snippet, which carries its own copies).
module.exports = (config) => withPodfilePatch(withNoPrecompiled(config));
module.exports.EXPO_PREFIXES = EXPO_PREFIXES;
module.exports.SKIP = SKsIP;

/**
 * Config plugin: make Expo SDK 56 compile under Xcode 26 / Swift 6.2.
 *
 * Two incompatibilities, fixed together:
 *
 * 1. Expo 56's precompiled Swift `.xcframework`s (ExpoModulesJSI etc.) are built
 *    for an older Swift and fail under Xcode 26. We disable precompiled modules
 *    (`EXPO_USE_PRECOMPILED_MODULES=false`) so the pods build from source, where
 *    we can control the language mode.
 *
 * 2. Those source files use `weak` stored properties inside `Sendable` classes.
 *    Swift 6.2 makes that uncompilable (`weak` needs `var`; a `Sendable` class
 *    forbids a mutable stored property). Building the Expo pods in Swift 5
 *    language mode downgrades that to a warning. (Paired with the
 *    `expo-modules-jsi` `weak let`→`weak var` pnpm patch, since `weak let` is
 *    rejected in every Swift mode.)
 *
 * Both are injected so they survive every `expo prebuild`.
 */
const { withDangerousMod, withPodfileProperties } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const MARKER = '// getsava:expo-swift5';

const SNIPPET = `
  post_install do |installer|
    ${MARKER}
    installer.pods_project.targets.each do |target|
      if target.name.start_with?('Expo')
        target.build_configurations.each do |config|
          config.build_settings['SWIFT_VERSION'] = '5.0'
        end
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

module.exports = (config) => withPodfilePatch(withNoPrecompiled(config));

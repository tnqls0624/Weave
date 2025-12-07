const { withXcodeProject, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const withFirebaseXcode = (config) => {
  return withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;

    // Get all build configurations
    const buildConfigurations = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key in buildConfigurations) {
      const buildConfig = buildConfigurations[key];
      if (buildConfig.buildSettings) {
        // Allow non-modular includes in framework modules
        buildConfig.buildSettings.CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = "YES";
      }
    }

    return config;
  });
};

const withFirebasePodfile = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );

      let podfileContent = fs.readFileSync(podfilePath, "utf8");

      // Add modular headers for Firebase dependencies after prepare_react_native_project!
      const modularHeadersCode = `
# Firebase modular headers fix
pod 'GoogleUtilities', :modular_headers => true
pod 'FirebaseCore', :modular_headers => true
pod 'FirebaseCoreInternal', :modular_headers => true
`;

      if (!podfileContent.includes("Firebase modular headers fix")) {
        podfileContent = podfileContent.replace(
          "prepare_react_native_project!",
          `prepare_react_native_project!\n${modularHeadersCode}`
        );
        fs.writeFileSync(podfilePath, podfileContent);
      }

      return config;
    },
  ]);
};

const withFirebaseFix = (config) => {
  config = withFirebaseXcode(config);
  config = withFirebasePodfile(config);
  return config;
};

module.exports = withFirebaseFix;

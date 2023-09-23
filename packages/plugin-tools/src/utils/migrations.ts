import { Tree, readJson, updateJson } from '@nx/devkit';
export function updateDemoAppPackages(tree: Tree, updates: { dependencies?: any; devDependencies?: any }) {
  const appFolders = tree.children('apps');
  for (const dir of appFolders) {
    if (dir.indexOf('demo') > -1) {
      const appDir = `apps/${dir}`;

      // update demo app deps
      const packagePath = `${appDir}/package.json`;
      if (tree.exists(packagePath)) {
        const packageJson = readJson(tree, packagePath);
        if (packageJson.devDependencies) {
          let hasNativeScriptRuntimes = false;
          for (const d in packageJson.devDependencies) {
            if (d.indexOf('@nativescript') > -1) {
              hasNativeScriptRuntimes = true;
              break;
            }
          }
          if (hasNativeScriptRuntimes) {
            // only update {N} demos determined by if they have runtime deps
            // some plugin authors may have server demos for other things
            updateJson(tree, packagePath, (packageJson) => {
              if (updates.dependencies) {
                packageJson.dependencies = {
                  ...(packageJson.dependencies || {}),
                  ...updates.dependencies,
                };
              }
              if (updates.devDependencies) {
                packageJson.devDependencies = {
                  ...(packageJson.devDependencies || {}),
                  ...updates.devDependencies,
                };
              }

              return packageJson;
            });
          }
        } else {
          // {N} demo app should have runtimes in devDependencies at least
          break;
        }
      }
    }
  }
}

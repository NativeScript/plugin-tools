import { join } from 'path';
import * as fs from 'fs';
import { generateFiles, joinPathFragments, readJson, Tree, updateJson, writeJson } from '@nrwl/devkit';

export default async function (tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    json.scripts = json.scripts || {};
    const postInstallParts = ['husky install', 'npx ts-patch install'];
    if (json.scripts.postinstall) {
      // include parts that are not there yet
      const origParts = json.scripts.postinstall.split('&&').map((p) => p.trim());
      for (const p of origParts) {
        if (!postInstallParts.includes(p) && p.indexOf('husky/lib') === -1) {
          postInstallParts.push(p);
        }
      }
    }
    json.scripts.postinstall = postInstallParts.join(' && ');
    json.scripts['setup'] = 'npx rimraf node_modules package-lock.json dist tmp yarn.lock && yarn config set ignore-engines true && ns package-manager set npm && yarn';
    json.scripts['sync-packages-with-demos'] = `nx g @nativescript/plugin-tools:sync-packages-with-demos`;
    json.scripts['remove-package'] = `nx g @nativescript/plugin-tools:remove-package`;
    json.scripts['add-demo'] = `nx g @nativescript/plugin-tools:add-demo`;
    json.devDependencies = json.devDependencies || {};
    json.devDependencies = {
      ...json.devDependencies,
      '@angular/animations': '^12.0.0',
      '@angular/common': '^12.0.0',
      '@angular/compiler': '^12.0.0',
      '@angular/compiler-cli': '^12.0.0',
      '@angular/core': '^12.0.0',
      '@angular/forms': '^12.0.0',
      '@angular/platform-browser': '^12.0.0',
      '@angular/platform-browser-dynamic': '^12.0.0',
      '@angular/router': '^12.0.0',
      '@nativescript/angular': '^12.0.0',
      '@nativescript/core': '^8.0.0',
      '@nativescript/webpack': 'beta',
      '@nativescript/types': '^8.0.0',
      '@ngtools/webpack': '^12.0.0',
      husky: '^5.1.3',
      'nativescript-vue': '~2.9.0',
      'nativescript-vue-template-compiler': '~2.9.0',
      'ng-packagr': '^12.0.0',
      'zone.js': '~0.11.1',
      typescript: '~4.2.0',
    };

    delete json['husky'];

    json['lint-staged'] = {
      '**/*.{js,ts,scss,json,html}': ['npx prettier --write'],
    };

    return json;
  });

  addHuskyPrecommit(tree);
  updateDemoFiles(tree);
  updateDemoFiles(tree, 'angular');
  updateDemoAppPackages(tree);
  updatePackages(tree);
  updateTSConfig(tree);
  updateWorkspace(tree);

  console.log(`\n   NOTE: Your plugin workspace is now migrated. Run this to finish the dependency cleanup:`);
  console.log(`\n`);
  console.log(`      npm run setup`);
  console.log(`\n`);
  console.log(`   This will ensure your workspace is properly reset with all the updates.`);
  console.log(`   It is also recommended to clean all your demo apps.`);
  console.log(`\n`);
}

function updateDemoFiles(tree: Tree, type?: 'angular') {
  const demoPath = `apps/demo${type ? '-' + type : ''}`;
  console.log(`Updating webpack config for: ${demoPath}`);

  const cwd = process.cwd();
  const webpackConfigPath = join(cwd, `node_modules/@nativescript/plugin-tools/src/migrations/update-2-0-0/_files_demo${type ? '_' + type : ''}/webpack.config.js`);
  // console.log('webpackConfigPath:', webpackConfigPath);
  const webpackConfig = fs.readFileSync(webpackConfigPath, {
    encoding: 'utf-8',
  });
  tree.write(`${demoPath}/webpack.config.js`, webpackConfig);

  // remove ~ from css imports for webpack5
  const demoAppCssPath = `${demoPath}/src/app.css`;
  const appCssPath = join(cwd, demoAppCssPath);
  // console.log('webpackConfigPath:', webpackConfigPath);
  if (fs.existsSync(appCssPath)) {
    const appCss = fs.readFileSync(appCssPath, {
      encoding: 'utf-8',
    });
    const scssImports = `@import 'nativescript-theme-core/scss/light';
  @import 'nativescript-theme-core/scss/index';`;
    tree.write(`${demoPath}/src/app.scss`, appCss.replace(`@import '~nativescript-theme-core/css/core.light.css';`, scssImports));
    tree.delete(demoAppCssPath);
  }

  switch (type) {
    case 'angular':
      // add polyfills
      const polyfillsPath = join(cwd, `node_modules/@nativescript/plugin-tools/src/migrations/update-2-0-0/_files_demo_angular/polyfills.ts__tmpl__`);
      // console.log('polyfillsPath:', polyfillsPath);
      const polyfills = fs.readFileSync(polyfillsPath, {
        encoding: 'utf-8',
      });
      tree.write(`${demoPath}/src/polyfills.ts`, polyfills);

      // adjust main
      const ngMain = `import { runNativeScriptAngularApp, platformNativeScript } from '@nativescript/angular';
import { AppModule } from './app.module';

runNativeScriptAngularApp({
  appModuleBootstrap: () => platformNativeScript().bootstrapModule(AppModule),
});
        `;
      tree.write(`${demoPath}/src/main.ts`, ngMain);

      // update tsconfig
      const tsconfigPath = `${demoPath}/tsconfig.json`;
      updateJson(tree, tsconfigPath, (json) => {
        if (json && json.files) {
          if (!json.files.includes('./src/polyfills.ts')) {
            json.files.push('./src/polyfills.ts');
          }
        }
        return json;
      });

      break;
  }
}

function updateDemoAppPackages(tree: Tree) {
  const appFolders = tree.children('apps');
  for (const dir of appFolders) {
    // console.log(dir);
    if (dir.indexOf('demo') > -1) {
      const appDir = `apps/${dir}`;
      // console.log('appDir:', appDir);

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
          if (!hasNativeScriptRuntimes) {
            // not a {N} demo app
            return;
          }
        } else {
          // {N} demo app should have runtimes in devDependencies at least
          return;
        }

        updateJson(tree, packagePath, (packageJson) => {
          if (appDir.indexOf('angular') > -1) {
            packageJson.main = `./src/main.ts`;
            for (const key in packageJson.dependencies) {
              if (key.indexOf('@angular/') > -1) {
                delete packageJson.dependencies[key];
              }
            }
            delete packageJson.dependencies['@nativescript/angular'];
            delete packageJson.dependencies['reflect-metadata'];
            delete packageJson.dependencies['rxjs'];
            delete packageJson.dependencies['zone.js'];
          } else if (appDir.indexOf('svelte') > -1 || appDir.indexOf('vue') > -1) {
            packageJson.main = `./app/app.ts`;
          } else {
            packageJson.main = `./src/app.ts`;
          }
          delete packageJson.dependencies['nativescript-theme-core'];
          packageJson.devDependencies = {
            '@nativescript/android': '8.0.0',
            '@nativescript/ios': '8.0.0',
          };

          return packageJson;
        });
      }
    }
  }
}

function updatePackages(tree: Tree) {
  const packageFolders = tree.children('packages');
  for (const dir of packageFolders) {
    // console.log(dir);
    const packageDir = `packages/${dir}`;
    // console.log('packageDir:', packageDir);
    const ngPackagePath = `${packageDir}/angular/package.json`;
    // console.log('ngPackagePath:', ngPackagePath);
    if (tree.exists(ngPackagePath)) {
      updateJson(tree, ngPackagePath, (ngPackageJson) => {
        if (ngPackageJson && ngPackageJson.ngPackage.whitelistedNonPeerDependencies) {
          const peerValue = ngPackageJson.ngPackage.whitelistedNonPeerDependencies;
          delete ngPackageJson.ngPackage.whitelistedNonPeerDependencies;
          ngPackageJson.ngPackage.allowedNonPeerDependencies = peerValue;
        }
        return ngPackageJson;
      });

      const tsconfgNg = {
        extends: '../../../tsconfig.base.json',
        compilerOptions: {
          outDir: '../../../dist/out-tsc',
          rootDir: '.',
        },
      };

      writeJson(tree, `${packageDir}/angular/tsconfig.json`, tsconfgNg);
    }
  }
}

function updateTSConfig(tree: Tree) {
  const baseTsConfigPath = 'tsconfig.base.json';

  updateJson(tree, baseTsConfigPath, (tsconfigJson) => {
    if (tsconfigJson && tsconfigJson.compilerOptions && tsconfigJson.compilerOptions.plugins) {
      tsconfigJson.compilerOptions.plugins = [
        {
          transform: '@nativescript/webpack/dist/transformers/NativeClass',
          type: 'raw',
        },
      ];
    }
    return tsconfigJson;
  });
  
}

function updateWorkspace(tree: Tree) {
  updateJson(tree, 'workspace.json', (json) => {
      json.version = 2;
      json.projects = json.projects || {};
      for (const project in json.projects) {
        if (json.projects[project].projectType === 'application') {
          // update to use targets/executor
          delete json.projects[project].architect;
          json.projects[project].targets = {
            build: {
              executor: '@nativescript/nx:build',
              options: {
                noHmr: true,
                production: true,
                uglify: true,
                release: true,
                forDevice: true,
              },
            },
            ios: {
              executor: '@nativescript/nx:build',
              options: {
                platform: 'ios',
              },
            },
            android: {
              executor: '@nativescript/nx:build',
              options: {
                platform: 'android',
              },
            },
            clean: {
              executor: '@nativescript/nx:build',
              options: {
                clean: true,
              },
            },
          };
        } else if (json.projects[project].projectType === 'library') {
          let targets = json.projects[project].targets;
          if (!targets) {
            targets = json.projects[project].architect;
            delete json.projects[project].architect;
            json.projects[project].targets = targets;
          }
          if (targets && targets.build && targets.build.options && targets.build.options.main) {
            const mainIndex = targets.build.options.main;
            if (mainIndex.indexOf('index.d.ts') === -1) {
              // update to use index.d.ts since plugins don't use an explicit index.ts but rather .ios/.android indices
              json.projects[project].targets.build.options.main = mainIndex.replace('index.ts', 'index.d.ts');
            }
          }
          for (const t in json.projects[project].targets) {
            if (json.projects[project].targets[t].builder) {
              json.projects[project].targets[t].executor = json.projects[project].targets[t].builder;
              delete json.projects[project].targets[t].builder;
            }
          }
        }
      }

      return json;
    });

}
function addHuskyPrecommit(tree: Tree) {
  console.log(`Updating husky precommit...`);

  generateFiles(tree, joinPathFragments(__dirname, '_files_husky'), '', {
    tmpl: '',
    dot: '.',
  });
}

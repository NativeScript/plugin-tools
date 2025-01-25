import { formatFiles, Tree, updateJson, updateNxJson } from '@nx/devkit';
import { readModulePackageJson } from 'nx/src/utils/package-json';
import { updateDemoAppPackages } from '../../utils/migrations';
import { dirname } from 'path';
const migrations = require('./migrations-to-run.json');

function readPackageMigrationConfig(packageName: string, dir?: string) {
  const { path: packageJsonPath, packageJson: json } = readModulePackageJson(packageName, dir ? [dir] : undefined);

  const migrationConfigOrFile = json['nx-migrations'] || json['ng-update'];

  if (!migrationConfigOrFile) {
    return { packageJson: json, migrations: null, packageGroup: [] };
  }

  const migrationsConfig =
    typeof migrationConfigOrFile === 'string'
      ? {
          migrations: migrationConfigOrFile,
          packageGroup: [],
        }
      : migrationConfigOrFile;

  try {
    const migrationFile = require.resolve(migrationsConfig.migrations, {
      paths: [dirname(packageJsonPath)],
    });

    return {
      packageJson: json,
      migrations: migrationFile,
      packageGroup: migrationsConfig.packageGroup,
    };
  } catch {
    return {
      packageJson: json,
      migrations: null,
      packageGroup: migrationsConfig.packageGroup,
    };
  }
}

export default async function (tree: Tree) {
  updateDependencies(tree);
  updateJson(tree, 'tsconfig.base.json', (json) => {
    json.compilerOptions = json.compilerOptions || {};
    json.compilerOptions.target = 'ES2020';
    json.compilerOptions.module = 'ESNext';
    json.compilerOptions.lib = ['ESNext', 'dom'];
    return json;
  });
  updateDemoAppPackages(tree, {
    devDependencies: {
      '@nativescript/android': '~8.8.0',
      '@nativescript/ios': '~8.8.0',
    },
  });
  // update demo project configs
  const flavors = ['', 'angular', 'react', 'svelte', 'vue'];
  for (const flavor of flavors) {
    const projectBase = `apps/demo${flavor ? '-' + flavor : ''}`;
    const projectConfigPath = `${projectBase}/project.json`;
    if (tree.exists(projectConfigPath)) {
      updateJson(tree, projectConfigPath, (json) => {
        delete json.targets.ios;
        delete json.targets.android;
        json.targets.debug = {
          executor: '@nativescript/nx:debug',
          options: {
            noHmr: true,
            uglify: false,
            release: false,
            forDevice: false,
            prepare: false,
          },
        };
        json.targets.clean = {
          executor: '@nativescript/nx:clean',
          options: {},
        };

        if (json.targets?.build?.options) {
          json.targets.build.options.tsConfig = `${projectBase}/tsconfig.json`;
        }
        return json;
      });
    }
  }
  // update workspace scripts
  fixWorkspaceScripts(tree);

  updateJson(tree, 'nx.json', (json) => {
    json.release = {
      releaseTagPattern: '{version}-{projectName}',
      projects: ['packages/*'],
      projectsRelationship: 'independent',
      changelog: {
        workspaceChangelog: false,
        projectChangelogs: {
          renderOptions: {
            authors: true,
            commitReferences: true,
            versionTitleDate: true,
          },
        },
      },
    };
    return json;
  });
  for (const migration of migrations.migrations) {
    const packageName = migration.package;
    const implRelativePath = migration.implementation || migration.factory;
    const collectionPath = readPackageMigrationConfig(packageName).migrations;
    let implPath: string;

    if (collectionPath) {
      let fn: any;
      try {
        try {
          implPath = require.resolve(implRelativePath, {
            paths: [dirname(collectionPath)],
          });
        } catch (e) {
          // workaround for a bug in node 12
          implPath = require.resolve(`${dirname(collectionPath)}/${implRelativePath}`);
        }

        fn = require(implPath).default;
      } catch (e) {
        // ignore, most likely missing package
      }
      if (fn) {
        await fn(tree, {});
      }
    }
  }
  // TODO: Edit the generators to use the new tsconfig

  await formatFiles(tree);

  console.log(`\n   NOTE: Your plugin workspace is now migrated. Run this to finish the dependency cleanup:`);
  console.log(`\n`);
  console.log(`      npm run setup`);
  console.log(`\n`);
  console.log(`   This will ensure your workspace is properly reset with all the updates.`);
  console.log(`   It is also recommended to clean all your demo apps.`);
  console.log(`\n`);
}

function fixWorkspaceScripts(tree: Tree) {
  let workspaceScripts = tree.read('tools/workspace-scripts.js', 'utf-8');
  workspaceScripts = workspaceScripts.replace(`nx run demo:clean`, 'nx clean demo');
  workspaceScripts = workspaceScripts.replace(`nx run demo:ios`, 'nx debug demo ios');
  workspaceScripts = workspaceScripts.replace(`nx run demo:android`, 'nx debug demo android');
  const flavors = ['angular', 'react', 'svelte', 'vue'];
  for (const flavor of flavors) {
    workspaceScripts = workspaceScripts.replace(`nx run demo-${flavor}:clean`, `nx clean demo-${flavor}`);
    workspaceScripts = workspaceScripts.replace(`nx run demo-${flavor}:ios`, `nx debug demo-${flavor} ios`);
    workspaceScripts = workspaceScripts.replace(`nx run demo-${flavor}:android`, `nx debug demo-${flavor} android`);
  }
  tree.write('tools/workspace-scripts.js', workspaceScripts);
}

function updateDependencies(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    if (json.devDependencies['@angular/core']) {
      json.devDependencies['@angular-devkit/build-angular'] = '^19.0.0';
      for (const key in json.devDependencies) {
        if (key.indexOf('@angular/') > -1) {
          json.devDependencies[key] = '^19.0.0';
        }
        if (key.indexOf('@angular-eslint/') > -1) {
          json.devDependencies[key] = '^19.0.0';
        }
      }
    }
    json.devDependencies['@nativescript/angular'] = '^19.0.0';
    json.devDependencies['@nativescript/core'] = '~8.8.0';
    json.devDependencies['@nativescript/types'] = '~8.8.0';
    json.devDependencies['@ngtools/webpack'] = '^19.0.0';
    json.devDependencies['husky'] = '~9.0.0';
    json.devDependencies['ng-packagr'] = '^19.0.0';
    json.devDependencies['rxjs'] = '~7.8.0';
    json.devDependencies['zone.js'] = '~0.15.0';
    json.devDependencies['typescript'] = '~5.6.0';

    if (json.devDependencies['ts-patch']) {
      json.devDependencies['ts-patch'] = '^3.0.0';
    }
    return json;
  });
}

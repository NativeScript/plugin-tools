import { formatFiles, Tree, updateJson } from '@nx/devkit';
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
      '@nativescript/android': '~8.7.0',
      '@nativescript/ios': '~8.7.0',
    },
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

function updateDependencies(tree: Tree) {
  updateJson(tree, 'package.json', (json) => {
    if (json.devDependencies['@angular/core']) {
      json.devDependencies['@angular-devkit/build-angular'] = '^18.0.0';
      for (const key in json.devDependencies) {
        if (key.indexOf('@angular/') > -1) {
          json.devDependencies[key] = '^18.0.0';
        }
        if (key.indexOf('@angular-eslint/') > -1) {
          json.devDependencies[key] = '^18.0.0';
        }
      }
    }
    json.devDependencies['@nativescript/angular'] = '^18.0.0';
    json.devDependencies['@nativescript/core'] = '~8.7.0';
    json.devDependencies['@nativescript/types'] = '~8.7.0';
    json.devDependencies['@ngtools/webpack'] = '^18.0.0';
    json.devDependencies['husky'] = '~9.0.0';
    json.devDependencies['ng-packagr'] = '^18.0.0';
    json.devDependencies['rxjs'] = '~7.8.0';
    json.devDependencies['zone.js'] = '~0.14.0';
    json.devDependencies['typescript'] = '~5.4.0';

    if (json.devDependencies['ts-patch']) {
      json.devDependencies['ts-patch'] = '^3.0.0';
    }
    return json;
  });
}

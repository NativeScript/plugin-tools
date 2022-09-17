import { formatFiles, Tree, updateJson } from '@nrwl/devkit';
import { readModulePackageJson } from 'nx/src/utils/package-json';
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
  for (const migration of migrations.migrations) {
    const packageName = migration.package;
    const implRelativePath = migration.implementation || migration.factory;
    const collectionPath = readPackageMigrationConfig(packageName).migrations;
    let implPath: string;

    try {
      implPath = require.resolve(implRelativePath, {
        paths: [dirname(collectionPath)],
      });
    } catch (e) {
      // workaround for a bug in node 12
      implPath = require.resolve(`${dirname(collectionPath)}/${implRelativePath}`);
    }

    const fn = require(implPath).default;
    await fn(tree, {});
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
      json.devDependencies['@angular-devkit/build-angular'] = '^14.2.0';
      for (const key in json.devDependencies) {
        // only @angular/ as @angular-eslint is still on 14.0
        if (key.indexOf('@angular/') > -1) {
          json.devDependencies[key] = '^14.2.0';
        }
      }
    }
    json.devDependencies['@nativescript/angular'] = '^14.2.0';
    json.devDependencies['@nativescript/core'] = '~8.3.0';
    json.devDependencies['@nativescript/types'] = '~8.3.0';
    json.devDependencies['@ngtools/webpack'] = '^14.2.0';
    json.devDependencies['ng-packagr'] = '^14.2.0';
    return json;
  });
}

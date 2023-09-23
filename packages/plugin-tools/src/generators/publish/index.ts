import { sanitizeCollectionArgs, setPackageNamesToUpdate, getAllPackages, getNpmScope, prerun, jsonParse } from '../../utils';
import { Schema } from './schema';
import parseVersionString from 'parse-version-string';
import { Observable } from 'rxjs';
import { spawn } from 'child_process';
import * as path from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { Tree, serializeJson } from '@nx/devkit';

interface ISemVer {
  major: number;
  minor: number;
  patch: number;
  preReleaseLabel?: string;
  preReleaseType?: string;
  preReleaseIncrement?: number;
}

let publishPackages: Array<string>;
let packageVersions: Array<{
  name: string;
  package: string;
  version: string;
  parsedVersion: ISemVer;
}>;
let version: ISemVer;
let npmScope: string;
// console.log('__dirname:', __dirname);
const workspaceDir = path.resolve(__dirname, '../../../../../..');
// console.log(`workspaceDir:`, workspaceDir);
export default async function (tree: Tree, schema: Schema) {
  publishPackages = sanitizeCollectionArgs(schema.name);
  if (schema.version) {
    version = <ISemVer>parseVersionString(schema.version);
  }

  prerun(tree);
  if (schema.verify) {
    npmScope = getNpmScope();
    setPackageNamesToUpdate(publishPackages);
    const allPackages = getAllPackages(tree);
    packageVersions = [];
    // console.log('allPackages:', allPackages);

    if (!publishPackages || (publishPackages && publishPackages.length === 0)) {
      // when nothing is specified default to all
      publishPackages = allPackages;
    }

    for (const p of publishPackages) {
      // const packageJsonPath = `packages/${p}/package.json`;
      // const packageJson = getJsonFromFile(tree, packageJsonPath);

      const packageJsonPath = path.resolve(workspaceDir, 'packages', p, 'package.json');
      let packageJson: any = readFileSync(packageJsonPath, { encoding: 'utf-8' });
      if (packageJson) {
        packageJson = jsonParse(packageJson);
        // console.log(`packageJson:`, packageJson);
        const currentVersion = packageJson.version;
        const parsedVersion = <ISemVer>parseVersionString(currentVersion);
        if (version) {
          packageJson.version = schema.version;
        } else {
          // when no version is specified, bump the patch version
          // console.log('p:', p, 'version:', parsedVersion);
          if (parsedVersion.preReleaseLabel) {
            parsedVersion.preReleaseIncrement = typeof parsedVersion.preReleaseIncrement === 'number' ? parsedVersion.preReleaseIncrement + 1 : 0;
          } else {
            parsedVersion.patch = parsedVersion.patch + 1;
          }
          packageJson.version = `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}${parsedVersion.preReleaseLabel ? '-' + parsedVersion.preReleaseType + '.' + parsedVersion.patch : ''}`;
        }
        const fullPackageName = packageJson.name;
        console.log('\n\n👀 ', fullPackageName, '-- current:', currentVersion, '> ⬆ bumping to:', packageJson.version);
        packageVersions.push({
          name: fullPackageName,
          package: p,
          version: packageJson.version,
          parsedVersion: <ISemVer>parseVersionString(packageJson.version),
        });
        writeFileSync(packageJsonPath, serializeJson(packageJson));
        // tree.overwrite(packageJsonPath, serializeJson(packageJson));
      }
    }
  }

  if (schema.verify) {
    await new Promise<void>((resolve, reject) => {
      // console.log(options.args);
      let cnt = 0;
      const buildPackage = () => {
        const p = publishPackages[cnt];

        const cmdArgs = ['run', `${p}:build.all`];
        const child = spawn(`nx`, cmdArgs, {
          cwd: workspaceDir,
          stdio: 'inherit',
          shell: true,
        });

        child.on('error', (error) => {
          console.log('build emitted error:', error);
          reject(error);
        });
        child.on('close', (res) => {
          console.log('build finished with code:', res);
          child.kill();
          cnt++;
          if (cnt === publishPackages.length) {
            console.log(`✅ Successfully built ${packageVersions.map((p) => `${p.name}:${p.version}`).join(',')}`);
            resolve();
          } else {
            buildPackage();
          }
        });
      };
      buildPackage();
    });
  }
  if (schema.verify) {
    await new Promise<void>((resolve, reject) => {
      let cnt = 0;
      const publishPackage = () => {
        const p = publishPackages[cnt];
        const packageDetails = packageVersions.find((pck) => pck.package === p);
        console.log(`⚡ publishing ${packageDetails.name} ${packageDetails.version}`);

        // console.log('dist path:', path.resolve(workspaceDir, 'dist', 'packages', p));

        const cmdArgs = ['publish', '--access', 'public'];
        if (packageDetails.parsedVersion.preReleaseLabel) {
          cmdArgs.push(`--tag`);
          cmdArgs.push(packageDetails.parsedVersion.preReleaseType);
        }
        const child = spawn(`npm`, cmdArgs, {
          cwd: path.resolve(workspaceDir, 'dist', 'packages', p),
          stdio: 'inherit',
          shell: true,
        });

        child.on('error', (error) => {
          console.log('publish emitted error:', error);
          reject(error);
        });
        child.on('close', (res) => {
          console.log('publish finished with code:', res);
          child.kill();
          cnt++;
          if (cnt === publishPackages.length) {
            console.log(`🚀 Successfully published:\n${packageVersions.map((p) => `\n* ${p.name}:${p.version}`).join(', ')}\n\n`);
            resolve();
          } else {
            publishPackage();
          }
        });
      };
      publishPackage();
    });
  }
}

/**
 * Workspace utilities
 */
import { updateWorkspaceInTree, serializeJson } from '@nrwl/workspace';
import { Tree, parseJson, readJson } from '@nrwl/devkit';

// includes '@' prefix
let npmScope: string;
// raw scope without '@' prefix
let nxNpmScope: string;
// allow non-scoped packages
// maps package folder name to full npm name
// ie, { 'ui-calendar': 'nativescript-ui-calendar', 'camera': '@nativescript/camera' }, etc.
export interface INpmPackageNameMap { [key: string]: string };
let npmPackageNames: INpmPackageNameMap;

export function getNpmScope() {
  return npmScope;
}

export function getNxNpmScope() {
  return nxNpmScope;
}

export function getNpmPackageNames() {
  return npmPackageNames;
}

export function prerun(tree: Tree) {
  if (!npmScope) {
    const nxConfig = getJsonFromFile(tree, 'nx.json');
    if (nxConfig && nxConfig.npmScope) {
      nxNpmScope = nxConfig.npmScope;
      npmScope = `@${nxConfig.npmScope}`;
    }
  }
  checkPackages(tree);
}

let packageNamesToUpdate: Array<string>;

export function setPackageNamesToUpdate(names: Array<string>) {
  packageNamesToUpdate = names;
}

export function getPackageNamesToUpdate(): Array<string> {
  return packageNamesToUpdate ? packageNamesToUpdate.filter((n) => n.indexOf('.') === -1) : [];
}

export function updateWorkspaceJson(updates: any) {
  return updateWorkspaceInTree((json) => {
    for (const key in updates) {
      json[key] = {
        ...(json[key] || {}),
        ...updates[key],
      };
    }
    return json;
  });
}

export function getJsonFromFile(tree: Tree, path: string) {
  return readJson(tree, path);
}

export function jsonParse(content: string) {
  if (content) {
    return parseJson(content);
  }
  return {};
}

export function sanitizeCollectionArgs(value: string) {
  return (value || '')
    .split(',')
    .filter((i) => !!i)
    .map((t) => t.toLowerCase().trim())
    .sort();
}

export function getAllPackages(tree: Tree) {
  return tree
    .children('packages')
    .filter((n) => {
      // only include valid package structures (in case other misc folders are present)
      // ignore hidden files in packages folder (ie, .gitkeep)
      const packagePath = `packages/${n}/package.json`;
      const validPackage = tree.exists(`packages/${n}/package.json`) && n.indexOf('.') === -1;
      if (validPackage) {
        const packageJson = readJson(tree, packagePath);
        if (packageJson && packageJson.name) {
          if (!npmPackageNames) {
            npmPackageNames = {}
          }
          npmPackageNames[n] = packageJson.name;
        }
      }

      return validPackage;
    })
    .sort();
}

export function checkPackages(tree: Tree) {
  if (!packageNamesToUpdate) {
    // default to updating demo's for all packages in workspace
    setPackageNamesToUpdate(getAllPackages(tree));
  }
  // console.log('packageNamesToUpdate:' + packageNamesToUpdate);
}

export function updateJsonFile(tree: Tree, path: string, jsonData: any) {
  try {
    tree.write(path, serializeJson(jsonData));
    return tree;
  } catch (err) {
    // console.warn(err);
    throw new Error(`${path}: ${err}`);
  }
}

export function updateReadMe(tree: Tree, packages?: Array<string>) {
  const readmePath = 'README.md';
  let readmeContent = tree.read(readmePath).toString('utf-8');

  // Add package as build option
  const listPackageSectionIndex = readmeContent.indexOf(`- ${npmScope}`);
  const readmeStart = readmeContent.substring(0, listPackageSectionIndex);
  const listEndIndex = readmeContent.indexOf(`# How to`);
  const readmeEnd = readmeContent.substring(listEndIndex, readmeContent.length);
  const packageNames = packages || getAllPackages(tree);
  const npmPackageNames = getNpmPackageNames();
  let packageList = '';
  for (const packageName of packageNames) {
    packageList += `- [${npmPackageNames[packageName]}](packages/${packageName}/README.md)\n`;
  }
  readmeContent = `${readmeStart}${packageList}\n${readmeEnd}`;

  // console.log(readmeContent);
  tree.write(readmePath, readmeContent);
}

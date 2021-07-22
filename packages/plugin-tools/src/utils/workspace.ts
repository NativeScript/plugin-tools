/**
 * Workspace utilities
 */
import { updateWorkspaceInTree, serializeJson } from '@nrwl/workspace';
import { Tree, parseJson, readJson } from '@nrwl/devkit';

// includes '@' prefix
let npmScope: string;
// raw scope without '@' prefix
let nxNpmScope: string;

export function getNpmScope() {
  return npmScope;
}

export function getNxNpmScope() {
  return nxNpmScope;
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
  return packageNamesToUpdate;
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
  return tree.children('packages').sort();
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

export function updateReadMe(tree: Tree) {
  const readmePath = 'README.md';
  let readmeContent = tree.read(readmePath).toString('utf-8');

  // Add package as build option
  const listPackageSectionIndex = readmeContent.indexOf(`- ${npmScope}`);
  const readmeStart = readmeContent.substring(0, listPackageSectionIndex);
  const listEndIndex = readmeContent.indexOf(`# How to`);
  const readmeEnd = readmeContent.substring(listEndIndex, readmeContent.length);
  const packageNames = getAllPackages(tree);
  let packageList = '';
  for (const packageName of packageNames) {
    packageList += `- ${npmScope}/${packageName}\n`;
  }
  readmeContent = `${readmeStart}${packageList}\n${readmeEnd}`;

  // console.log(readmeContent);
  tree.write(readmePath, readmeContent);
}

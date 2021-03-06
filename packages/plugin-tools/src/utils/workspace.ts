/**
 * Workspace utilities
 */
import {
  Tree,
  SchematicContext,
  SchematicsException,
} from '@angular-devkit/schematics';
import {
  updateWorkspaceInTree,
  readJsonInTree,
  getWorkspacePath,
  serializeJson,
} from '@nrwl/workspace';
import * as stripJsonComments from 'strip-json-comments';

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

export function prerun() {
  return (tree: Tree, context: SchematicContext) => {
    if (!npmScope) {
      const nxConfig = getJsonFromFile(tree, 'nx.json');
      if (nxConfig && nxConfig.npmScope) {
        nxNpmScope = nxConfig.npmScope;
        npmScope = `@${nxConfig.npmScope}`;
      }
    }
    checkPackages(tree, context);
  };
}

let packageNamesToUpdate: Array<string>;

export function setPackageNamesToUpdate(names: Array<string>) {
  packageNamesToUpdate = names;
}

export function getPackageNamesToUpdate(): Array<string> {
  return packageNamesToUpdate;
}

export function readWorkspaceJson(tree: Tree) {
  return readJsonInTree(tree, getWorkspacePath(tree));
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
  return jsonParse(tree.get(path).content.toString());
}

export function jsonParse(content: string) {
  if (content) {
    // ensure comments are stripped when parsing (otherwise will fail)
    return JSON.parse(stripJsonComments(content));
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
  return tree.getDir('packages').subdirs.sort();
}

export function checkPackages(tree: Tree, context: SchematicContext) {
  if (!packageNamesToUpdate) {
    // default to updating demo's for all packages in workspace
    setPackageNamesToUpdate(getAllPackages(tree));
  }
  // context.logger.info('packageNamesToUpdate:' + packageNamesToUpdate);
}

export function updateJsonFile(tree: Tree, path: string, jsonData: any) {
  try {
    tree.overwrite(path, serializeJson(jsonData));
    return tree;
  } catch (err) {
    // console.warn(err);
    throw new SchematicsException(`${path}: ${err}`);
  }
}

export function updateReadMe() {
  return (tree: Tree, context: SchematicContext) => {
    const readmePath = 'README.md';
    let readmeContent = tree.read(readmePath).toString('utf-8');

    // Add package as build option
    const listPackageSectionIndex = readmeContent.indexOf(`- ${npmScope}`);
    const readmeStart = readmeContent.substring(0, listPackageSectionIndex);
    const listEndIndex = readmeContent.indexOf(`# How to`);
    const readmeEnd = readmeContent.substring(
      listEndIndex,
      readmeContent.length
    );
    const packageNames = getAllPackages(tree);
    let packageList = '';
    for (const packageName of packageNames) {
      packageList += `- ${npmScope}/${packageName}\n`;
    }
    readmeContent = `${readmeStart}${packageList}\n${readmeEnd}`;

    // context.logger.info(readmeContent);
    tree.overwrite(readmePath, readmeContent);
    return tree;
  };
}

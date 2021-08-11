import { Tree, readJson, updateJson, formatFiles, generateFiles, joinPathFragments } from '@nrwl/devkit';
import { stringUtils } from '@nrwl/workspace';
import { sanitizeCollectionArgs, setPackageNamesToUpdate, setDemoTypes, SupportedDemoTypes, SupportedDemoType, getDemoTypes, getPackageNamesToUpdate, getDemoAppRoot, addDependencyToDemoApp, checkPackages, getDemoIndexButtonForType, getDemoIndexPathForType, resetAngularIndex, getPluginDemoPath, resetAngularRoutes, updateDemoSharedIndex, getAllPackages, prerun, getNpmScope, getDemoFlavorExt, getNpmPackageNames, INpmPackageNameMap } from '../../utils';
import { Schema } from './schema';

let npmPackageNames: INpmPackageNameMap;
export default function (tree: Tree, schema?: Schema, relativePrefix?: string, addingNew?: boolean) {
  if (schema) {
    if (schema.types) {
      // only updating specific demo types
      const demoTypes = <Array<SupportedDemoType>>sanitizeCollectionArgs(schema.types);
      for (const t of demoTypes) {
        if (!SupportedDemoTypes.includes(t)) {
          throw new Error(`Can only update supported demo types: ${SupportedDemoTypes.join()}`);
        }
      }
      setDemoTypes(demoTypes);
    }
    if (schema.packages) {
      // only updating demo's for specific packages
      setPackageNamesToUpdate(sanitizeCollectionArgs(schema.packages).sort());
    }
  }

  prerun(tree);
  npmPackageNames = getNpmPackageNames();
  for (const t of getDemoTypes()) {
    const demoAppRoot = getDemoAppRoot(t);
    if (tree.exists(`${demoAppRoot}/package.json`)) {
      addDemoFiles(tree, t, demoAppRoot, relativePrefix);
      addToDemoIndex(tree, t, demoAppRoot);
      addDependencyToDemoApp(tree, t, demoAppRoot);
    }
  }
  addDemoSharedFiles(tree, relativePrefix);
  updateDemoSharedIndex(tree, getAllPackages(tree), getPackageNamesToUpdate(), addingNew);

  formatFiles(tree);
}

function addDemoFiles(tree: Tree, type: SupportedDemoType, demoAppRoot: string, relativePrefix: string = '') {
    console.log(`Updating "${demoAppRoot}"`);
    const demoAppFolder = `${demoAppRoot}/${getPluginDemoPath(type)}`;
    const { viewExt, viewClassExt, viewModuleExt } = getDemoFlavorExt(type);

    for (const name of getPackageNamesToUpdate()) {
      const packageDemoViewPath = `${demoAppFolder}/${name}.${viewExt}`;
      // console.log('packageDemoViewPath: ' + packageDemoViewPath);
      if (!tree.exists(packageDemoViewPath)) {
        // console.log('packageDemoViewPath: DID NOT EXIST!');
        generateFiles(tree, joinPathFragments(__dirname, relativePrefix, `files_${type}`), demoAppFolder, {
          name,
          npmPackageName: npmPackageNames[name],
          npmScope: getNpmScope(),
          stringUtils,
          tmpl: '',
          dot: '.',
        });
      }
    }

}

function addToDemoIndex(tree: Tree, type: SupportedDemoType, demoAppRoot: string) {
  checkPackages(tree);
  if (type === 'angular') {
    resetAngularIndex(tree, getPackageNamesToUpdate(), true);
    resetAngularRoutes(tree, getPackageNamesToUpdate(), true);
    return tree;
  } else if (['react', 'svelte', 'vue']) {
    // TODO: add index page for these flavors
    return tree;
  }

  const demoIndexViewPath = `${demoAppRoot}/${getDemoIndexPathForType(type)}`;
  let indexViewContent = tree.read(demoIndexViewPath).toString('utf-8');
  // adjust index view app path dependent on demo type
  for (const name of getPackageNamesToUpdate()) {
    switch (type) {
      case 'xml':
        const { buttonMarkup } = getDemoIndexButtonForType(type, name);

        if (indexViewContent.indexOf(`Button text="${name}"`) === -1) {
          // get index of last view-demo button
          const lastBtnLocatorIndex = indexViewContent.lastIndexOf('view-demo');
          // get final content after that last button
          const remainingContent = indexViewContent.substr(lastBtnLocatorIndex, indexViewContent.length);
          // get first line break to determine position of where to insert next button
          const firstLB = remainingContent.indexOf('\n');
          const endingContent = indexViewContent.substring(lastBtnLocatorIndex + firstLB, indexViewContent.length);
          // console.log('buttonMarkup: ' + buttonMarkup);
          indexViewContent = indexViewContent.substring(0, lastBtnLocatorIndex + firstLB) + `\n${buttonMarkup}` + endingContent;
        }

        break;
    }
  }
  // console.log(indexViewContent);
  tree.write(demoIndexViewPath, indexViewContent);
}

function addDemoSharedFiles(tree: Tree, relativePrefix: string = '') {
  const demoSharedPath = `tools/demo`;
  console.log(`Updating shared demo code in "${demoSharedPath}"`);

  for (const name of getPackageNamesToUpdate()) {
    const demoSharedIndex = `${demoSharedPath}/${name}/index.ts`;
    // console.log('packageDemoViewPath: ' + packageDemoViewPath);
    if (!tree.exists(demoSharedIndex)) {
      // console.log('packageDemoViewPath: DID NOT EXIST!');
      generateFiles(tree, joinPathFragments(__dirname, relativePrefix, `files_demo_shared`), demoSharedPath, {
        name,
        npmPackageName: npmPackageNames[name],
        npmScope: getNpmScope(),
        stringUtils,
        tmpl: '',
        dot: '.',
      });
    }
  }
}

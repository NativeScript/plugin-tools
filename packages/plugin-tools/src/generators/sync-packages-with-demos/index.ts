import { Tree, readJson, updateJson, formatFiles, generateFiles } from '@nrwl/devkit';
import { stringUtils } from '@nrwl/workspace';
import { sanitizeCollectionArgs, setPackageNamesToUpdate, setDemoTypes, SupportedDemoTypes, SupportedDemoType, getDemoTypes, getPackageNamesToUpdate, getDemoAppRoot, addDependencyToDemoApp, checkPackages, getDemoIndexButtonForType, getDemoIndexPathForType, resetAngularIndex, getPluginDemoPath, resetAngularRoutes, updateDemoSharedIndex, getAllPackages, prerun, getNpmScope } from '../../utils';
import { Schema } from './schema';

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
  const demoFileChains: Array<any> = [];
  const demoIndexChains: Array<any> = [];
  const demoDependencyChains: Array<any> = [];

  for (const t of getDemoTypes()) {
    const demoAppRoot = getDemoAppRoot(t);
    demoFileChains.push(addDemoFiles(tree, t, demoAppRoot, relativePrefix));
    demoIndexChains.push(addToDemoIndex(tree, t, demoAppRoot));
    demoDependencyChains.push(addDependencyToDemoApp(tree, t, demoAppRoot));
  }

  prerun(tree);
  for (const d of demoFileChains) {
    d();
  }
  for (const d of demoIndexChains) {
    d();
  }
  for (const d of demoDependencyChains) {
    d();
  }
  addDemoSharedFiles(tree, relativePrefix);
  updateDemoSharedIndex(tree, getAllPackages(tree), getPackageNamesToUpdate(), addingNew);

  formatFiles(tree);
}

function addDemoFiles(tree: Tree, type: SupportedDemoType, demoAppRoot: string, relativePrefix: string = './') {
  return () => {
    console.log(`Updating "${demoAppRoot}"`);
    const demoAppFolder = `${demoAppRoot}/${getPluginDemoPath()}`;
    let viewExt = 'xml';
    // adjust folder location and viewExt dependent on demo type if needed
    switch (type) {
      case 'angular':
        viewExt = 'component.html';
        break;
    }
    for (const name of getPackageNamesToUpdate()) {
      const packageDemoViewPath = `${demoAppFolder}/${name}.${viewExt}`;
      // console.log('packageDemoViewPath: ' + packageDemoViewPath);
      if (!tree.exists(packageDemoViewPath)) {
        // console.log('packageDemoViewPath: DID NOT EXIST!');
        generateFiles(tree, `${relativePrefix}files_${type}`, demoAppFolder, {
          name,
          npmScope: getNpmScope(),
          stringUtils,
          tmpl: '',
          dot: '.',
        });
      }
    }
  };
}

function addToDemoIndex(tree: Tree, type: SupportedDemoType, demoAppRoot: string) {
  checkPackages(tree);
  if (type === 'angular') {
    resetAngularIndex(tree, getPackageNamesToUpdate(), true);
    resetAngularRoutes(tree, getPackageNamesToUpdate(), true);
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

function addDemoSharedFiles(tree: Tree, relativePrefix: string = './') {
  const demoSharedPath = `tools/demo`;
  console.log(`Updating shared demo code in "${demoSharedPath}"`);

  for (const name of getPackageNamesToUpdate()) {
    const demoSharedIndex = `${demoSharedPath}/${name}/index.ts`;
    // console.log('packageDemoViewPath: ' + packageDemoViewPath);
    if (!tree.exists(demoSharedIndex)) {
      // console.log('packageDemoViewPath: DID NOT EXIST!');
      generateFiles(tree, `${relativePrefix}files_demo_shared`, demoSharedPath, {
        name,
        npmScope: getNpmScope(),
        stringUtils,
        tmpl: '',
        dot: '.',
      });
    }
  }
}

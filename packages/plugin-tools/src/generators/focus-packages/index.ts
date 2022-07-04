import { sanitizeCollectionArgs, getDemoTypeFromName, updateDemoDependencies, setPackageNamesToUpdate, getAllPackages, resetIndexForDemoType, getPluginDemoPath, updateDemoSharedIndex, getNpmScope, prerun, getNpmPackageNames, getSrcFolderForType } from '../../utils';
import { Schema } from './schema';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { Tree } from '@nrwl/devkit';

let focusPackages: Array<string>;
let allPackages: Array<string>;
export default async function (tree: Tree, schema: Schema) {
  focusPackages = sanitizeCollectionArgs(schema.name);

  prerun(tree);
  // Focus workspace
  const nstudioFocus = wrapAngularDevkitSchematic('@nstudio/focus', 'mode');
  await nstudioFocus(tree, {
    name: schema.name,
  });
  setPackageNamesToUpdate(focusPackages);
  allPackages = getAllPackages(tree);
  const npmPackageNames = getNpmPackageNames();
  // console.log('allPackages:', allPackages);
  // Isolate code in demo apps by default based on focus
  if (!schema.ignoreDemos) {
    // adjust demo shared index for focusing
    updateDemoSharedIndex(tree, allPackages, focusPackages);

    // apps
    const appFolders = tree.children('apps');
    for (const dir of appFolders) {
      // console.log(`demoAppRoot: ${demoAppRoot}`);
      const demoType = getDemoTypeFromName(dir);
      const demoViewsPath = `apps/${dir}/${getPluginDemoPath(demoType)}`;
      const demoModalViewsPath = `apps/${dir}/${getSrcFolderForType(demoType)}/modals`;
      const demoAppRoot = `apps/${dir}`;
      // console.log(`demoType: ${demoType}`);
      updateDemoDependencies(tree, demoType, demoAppRoot, allPackages, true);

      // add `_off` suffix on ts,xml files for those that not being focused on
      // this removes those from the app build
      for (const p of allPackages) {
        switch (demoType) {
          case 'xml':
            const xmlView = `${demoViewsPath}/${p}.xml`;
            // console.log('xmlView:', xmlView);
            const tsClass = `${demoViewsPath}/${p}.ts`;
            // console.log('tsClass:', tsClass);
            if (focusPackages.length === 0 || focusPackages.includes(p)) {
              // resetting all demos back on if no specified focus or
              // focus on specified packages by ensuring their demos are not off
              // console.log('remove _off for', p);
              if (tree.exists(`${xmlView}_off`)) {
                tree.rename(`${xmlView}_off`, xmlView);
              }
              if (tree.exists(`${tsClass}_off`)) {
                tree.rename(`${tsClass}_off`, tsClass);
              }
            } else {
              // Turns package demos off when not focusing on them
              if (tree.exists(xmlView)) {
                tree.rename(xmlView, `${xmlView}_off`);
              }
              if (tree.exists(tsClass)) {
                tree.rename(tsClass, `${tsClass}_off`);
              }
            }
            break;
        }
      }

      const allModals = tree.children(demoModalViewsPath);
      for (const filename of allModals) {
        switch (demoType) {
          case 'xml':
            const currentFilename = `${demoModalViewsPath}/${filename}`;
            let origFilename = currentFilename;
            if (currentFilename.indexOf('_off') > -1) {
              origFilename = currentFilename.split('_off')[0];
            }
            const relatedToFocusedPackage = focusPackages.find((p) => {
              return origFilename.indexOf(p) > -1;
            });
            if (focusPackages.length === 0 || relatedToFocusedPackage) {
              if (tree.exists(`${origFilename}_off`)) {
                tree.rename(`${origFilename}_off`, origFilename);
              }
            } else {
              if (tree.exists(origFilename)) {
                tree.rename(origFilename, `${origFilename}_off`);
              }
            }
            break;
        }
      }

      // cleanup index listing to only have buttons for what is being focused on
      resetIndexForDemoType(tree, demoType);
    }
  }

  const isFocusing = focusPackages && focusPackages.length > 0;
  const focusTargets = (focusPackages && focusPackages.length ? focusPackages : allPackages).map((n) => `\n${npmPackageNames[n]}`).join('');
  console.log(`${isFocusing ? 'Focusing workspace on:' : 'Resetting workspace for:'}\n${focusTargets}\n\n`);
  if (!schema.ignoreDemos) {
    console.log(` > NOTE: Clean the demo app you plan to test with before running now that the demo code has been updated.\n`);
  }
}

import { formatFiles, Tree, updateJson, updateNxJson } from '@nx/devkit';
import { readModulePackageJson } from 'nx/src/utils/package-json';
import { updateDemoAppPackages } from '../../utils/migrations';
import { dirname } from 'path';
const migrations = require('./migrations-to-run.json');

export default async function (tree: Tree) {
  updateDependencies(tree);
  updateDemoAppPackages(tree, {
    devDependencies: {
      '@nativescript/android': '~8.9.0',
      '@nativescript/ios': '~8.9.0',
    },
  });
  // update demo project configs
  const flavors = ['', 'angular', 'react', 'svelte', 'vue'];
  for (const flavor of flavors) {
    const projectBase = `apps/demo${flavor ? '-' + flavor : ''}`;
    const scssPath = `${projectBase}/src/app.scss`;
    if (tree.exists(scssPath)) {
      // add rounded class for tad more pleasing demo app index
      addRoundedDemoClass(tree, scssPath);
    }
    const scssPath2 = `${projectBase}/app/app.scss`;
    if (tree.exists(scssPath2)) {
      addRoundedDemoClass(tree, scssPath2);
    }
    const scssPath3 = `${projectBase}/app/app.ios.scss`;
    if (tree.exists(scssPath3)) {
      addRoundedDemoClass(tree, scssPath3);
    }
    const scssPath4 = `${projectBase}/app/app.android.scss`;
    if (tree.exists(scssPath4)) {
      addRoundedDemoClass(tree, scssPath4);
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
    json.devDependencies['@nativescript/core'] = '~8.9.0';
    json.devDependencies['@nativescript/types'] = '~8.9.0';
    return json;
  });
}

function addRoundedDemoClass(tree: Tree, scssPath: string) {
  let scssContent = tree.read(scssPath, 'utf-8');
  scssContent =
    scssContent +
    `
.rounded {
  border-radius: 20;
}`;
  tree.write(scssPath, scssContent);
}

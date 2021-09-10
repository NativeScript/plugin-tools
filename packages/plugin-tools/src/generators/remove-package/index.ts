import { Tree, removeProjectConfiguration, updateJson, readProjectConfiguration, updateProjectConfiguration, readJson } from '@nrwl/devkit';
import { stringUtils } from '@nrwl/workspace';
import { prerun, getNpmScope, getDemoTypes, getDemoAppRoot, getPluginDemoPath, SupportedDemoType, checkPackages, getDemoIndexPathForType, getPackageNamesToUpdate, getPathToPackageForDemo, updateReadMe, getNpmPackageNames } from '../../utils';
import { Schema } from './schema';

let name: string;
let npmPackageName: string;
export default function (tree: Tree, schema: Schema) {
  name = stringUtils.dasherize(schema.name);

  prerun(tree);
  const packagePath = `packages/${name}/package.json`;
  if (tree.exists(packagePath)) {
    const packageJson = readJson(tree, packagePath);
    npmPackageName = packageJson.name;
    removePackage(tree);
  
    removeProjectConfiguration(tree, name);
    removeFromBuildAll(tree);
  
    updateReadMe(tree, getUpdatedPackages(tree));
  
    for (const t of getDemoTypes()) {
      const demoAppRoot = getDemoAppRoot(t);
      removeDemoFiles(tree, t, demoAppRoot);
      removeFromDemoIndex(tree, t, demoAppRoot);
      updateDemoDependencies(tree, t, demoAppRoot);
    }
  
    removeSharedDemoFiles(tree);
    updateDemoSharedIndex(tree);
  
    console.log(`"${npmPackageName}" removed from 'packages' and removed from all demo apps.`);
  } else {
    console.error(`Nothing found at 'packages/${name}/package.json' to remove.`)
  }
}

function removePackage(tree: Tree) {
  console.log(`Removing plugin ${name}...`);

  tree.delete(`packages/${name}`);
}

function removeFromBuildAll(tree: Tree) {
  const allConfig = readProjectConfiguration(tree, 'all');
  if (allConfig) {
    let commands = [];
    if (allConfig.targets?.build?.options?.commands) {
      commands = allConfig.targets.build.options.commands;
      const index = commands.indexOf(`nx run ${name}:build.all`);
      if (index > -1) {
        commands.splice(index, 1);
      }
    }
    updateProjectConfiguration(tree, 'all', {
      ...allConfig,
      targets: {
        build: {
          executor: allConfig.targets.build.executor,
          outputs: ['dist/packages'],
          options: {
            commands,
            parallel: false,
          },
        },
        focus: allConfig.targets.focus,
      },
    });
  }
}
function removeDemoFiles(tree: Tree, type: SupportedDemoType, demoAppRoot: string) {
  const demoAppFolder = `${demoAppRoot}/${getPluginDemoPath(type)}`;
  console.log(`Removing demo files in "${demoAppFolder}"`);
  let viewExt = 'xml';
  let viewClassExt = 'ts';
  let viewModuleExt;
  // adjust folder location and viewExt dependent on demo type if needed
  switch (type) {
    case 'angular':
      viewExt = 'component.html';
      viewClassExt = 'component.ts';
      viewModuleExt = 'module.ts';
      break;
    case 'react':
      viewExt = 'tsx';
      viewClassExt = null;
      break;
    case 'svelte':
      viewExt = 'svelte';
      viewClassExt = null;
      break;
    case 'vue':
      viewExt = 'vue';
      viewClassExt = null;
      break;
  }
  let packageDemoViewModulePath;
  if (viewModuleExt) {
    packageDemoViewModulePath = `${demoAppFolder}/${name}.${viewModuleExt}`;
  }

  const packageDemoViewPath = `${demoAppFolder}/${name}.${viewExt}`;
  const packageDemoViewClassPath = viewClassExt ? `${demoAppFolder}/${name}.${viewClassExt}` : null;
  // console.log('packageDemoViewPath: ' + packageDemoViewPath);
  if (tree.exists(packageDemoViewPath)) {
    tree.delete(packageDemoViewPath);
  }
  if (packageDemoViewClassPath && tree.exists(packageDemoViewClassPath)) {
    tree.delete(packageDemoViewClassPath);
  }
  if (packageDemoViewModulePath && tree.exists(packageDemoViewModulePath)) {
    tree.delete(packageDemoViewModulePath);
  }
}

function removeFromDemoIndex(tree: Tree, type: SupportedDemoType, demoAppRoot: string) {
  checkPackages(tree);
  if (type === 'angular') {
    resetAngularIndex(tree);
    resetAngularRoutes(tree);
    return tree;
  } else if (['react', 'svelte', 'vue'].includes(type)) {
    // TODO: add index page for these flavors
    return tree;
  }

  const demoIndexViewPath = `${demoAppRoot}/${getDemoIndexPathForType(type)}`;
  let indexViewContent = tree.read(demoIndexViewPath).toString('utf-8');
  indexViewContent = indexViewContent.replace(`<Button text="${name}" tap="{{ viewDemo }}" class="btn btn-primary view-demo"/>`, '');
  // console.log(indexViewContent);
  tree.write(demoIndexViewPath, indexViewContent);
}

export function resetAngularIndex(tree: Tree) {
  const angularIndexPath = `${getDemoAppRoot('angular')}/${getDemoIndexPathForType('angular')}`;
  let angularIndex = tree.read(angularIndexPath).toString();
  const demosIndex = angularIndex.indexOf('[');

  angularIndex =
    angularIndex.substring(0, demosIndex + 1) +
    getUpdatedPackages(tree)
      .sort()
      .map((p) => `\n	{\n		name: '${p}'\n	}`)
      .join(',') +
    '\n];\n}';
  tree.write(angularIndexPath, angularIndex);
}

export function resetAngularRoutes(tree: Tree) {
  const angularRouteModulePath = `${getDemoAppRoot('angular')}/src/app-routing.module.ts`;
  let angularRouteModule = tree.read(angularRouteModulePath).toString();
  const routeDefIndex = angularRouteModule.indexOf('const routes');
  const routeModuleStart = angularRouteModule.substring(0, routeDefIndex);
  const routeMoudleDefIndex = angularRouteModule.indexOf('@NgModule');
  const routeModuleEnd = angularRouteModule.substring(routeMoudleDefIndex, angularRouteModule.length);

  const packageRoutes =
    getUpdatedPackages(tree)
      .sort()
      .map((p) => `	{ path: '${p}', loadChildren: () => import('./plugin-demos/${p}.module').then(m => m.${stringUtils.classify(p)}Module) }`)
      .join(',\n') + '\n];\n\n';
  const routeStart = `const routes: Routes = [
   { path: '', redirectTo: '/home', pathMatch: 'full' },
   { path: 'home', component: HomeComponent },\n`;
  angularRouteModule = routeModuleStart + routeStart + packageRoutes + routeModuleEnd;
  // console.log('angularRouteModule:', angularRouteModule);
  tree.write(angularRouteModulePath, angularRouteModule);
}

export function updateDemoDependencies(tree: Tree, type: SupportedDemoType, demoAppRoot: string) {
  if (['react', 'svelte', 'vue'].includes(type)) {
    // TODO: add index page for these flavors
    return;
  }
  
  const packagePath = `${demoAppRoot}/package.json`;

  updateJson(tree, packagePath, (json) => {
    json.dependencies = json.dependencies || {};
    delete json.dependencies[npmPackageName];
    return json;
  });
}

function removeSharedDemoFiles(tree: Tree) {
  tree.delete(`tools/demo/${name}`);
}

export function updateDemoSharedIndex(tree: Tree) {
  const demoSharedPath = `tools/demo/index.ts`;
  const demoSharedExport = (name: string) => {
    return `export * from './${name}';\n`;
  };
  const demoSharedIndex = `export * from './utils';\n${getUpdatedPackages(tree).sort().map(demoSharedExport).join('')}`;
  tree.write(demoSharedPath, demoSharedIndex);
}

function getUpdatedPackages(tree: Tree) {
  checkPackages(tree);
  return getPackageNamesToUpdate().filter((n) => n !== name);
}

import { ProjectConfiguration, Tree, formatFiles, getProjects, logger } from '@nrwl/devkit';
import * as semver from 'semver';
import { BumpPackagesGeneratorSchema } from './schema';

interface NormalizedSchema extends BumpPackagesGeneratorSchema {
  projects: ProjectConfiguration[];
  versionBump: semver.ReleaseType | false;
  fixedVersion: string;
}

function isVersionBump(version: string): version is semver.ReleaseType {
  return ['major', 'premajor', 'minor', 'preminor', 'patch', 'prepatch', 'prerelease'].includes(version);
}

function normalizeOptions(tree: Tree, options: BumpPackagesGeneratorSchema): NormalizedSchema {
  const filters = {
    projectType: options.projectType ?? '',
    tags: options.tags?.split(',').map((s) => s.trim()),
  };
  console.log(filters);
  const projects = options.projectName
    ? [getProjects(tree).get(options.projectName)]
    : Array.from(getProjects(tree).values()).filter((v) => {
        if (filters.projectType) {
          if (v.projectType !== filters.projectType) {
            return false;
          }
        }
        if (filters.tags) {
          if (!v.tags.some((t) => filters.tags.includes(t))) {
            return false;
          }
        }
        return true;
      });

  const versionBump = isVersionBump(options.targetVersion) ? options.targetVersion : false;
  if (!versionBump) {
    if (!semver.parse(options.targetVersion)) {
      throw new Error(`Invalid version ${options.targetVersion}`);
    }
  }

  return {
    ...options,
    projects,
    versionBump,
    fixedVersion: versionBump ? '' : options.targetVersion,
  };
}

export default async function (tree: Tree, options: BumpPackagesGeneratorSchema) {
  const normalizedOptions = normalizeOptions(tree, options);
  normalizedOptions.projects.forEach((project) => {
    const packageJson = tree.read(`${project.root}/package.json`);
    if (!packageJson) {
      throw new Error(`Could not find package.json for project ${project.name}`);
    }
    const parsedPackageJson = JSON.parse(packageJson.toString());
    const oldVersion = parsedPackageJson.version;
    const newVersion = normalizedOptions.versionBump ? semver.inc(parsedPackageJson.version, normalizedOptions.versionBump) : normalizedOptions.fixedVersion;
    if (!newVersion) {
      throw new Error(`Could not bump version for project ${project.name}`);
    }
    if (semver.gte(oldVersion, newVersion)) {
      throw new Error(`New version (${newVersion}) is not greater than old version (${oldVersion}) for project ${project.name}, Skipping project`);
    }
    parsedPackageJson.version = newVersion;
    tree.write(`${project.root}/package.json`, JSON.stringify(parsedPackageJson, null, 2));
  });
  await formatFiles(tree);
}

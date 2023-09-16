import { Tree, addProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import generator from './generator';

describe('bump-packages generator', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
    appTree.write('apps/app/package.json', JSON.stringify({ version: '1.0.0' }));
    appTree.write('packages/lib/package.json', JSON.stringify({ version: '1.0.0' }));
    appTree.write('packages/lib2/package.json', JSON.stringify({ version: '2.0.0' }));
    addProjectConfiguration(appTree, 'app', {
      root: 'apps/app',
      projectType: 'application',
      tags: ['tag1', 'tag2'],
    });
    addProjectConfiguration(appTree, 'lib', {
      root: 'packages/lib',
      projectType: 'library',
      tags: ['tag2'],
    });
    addProjectConfiguration(appTree, 'lib2', {
      root: 'packages/lib2',
      projectType: 'library',
      tags: ['tag1'],
    });
  });

  it('should bump all by patch', async () => {
    await generator(appTree, {
      targetVersion: 'patch',
    });
    expect(JSON.parse(appTree.read('apps/app/package.json').toString()).version).toBe('1.0.1');
    expect(JSON.parse(appTree.read('packages/lib/package.json').toString()).version).toBe('1.0.1');
    expect(JSON.parse(appTree.read('packages/lib2/package.json').toString()).version).toBe('2.0.1');
  });

  it('should filter by type', async () => {
    await generator(appTree, {
      targetVersion: 'patch',
      projectType: 'library',
    });
    expect(JSON.parse(appTree.read('apps/app/package.json').toString()).version).toBe('1.0.0');
    expect(JSON.parse(appTree.read('packages/lib/package.json').toString()).version).toBe('1.0.1');
    expect(JSON.parse(appTree.read('packages/lib2/package.json').toString()).version).toBe('2.0.1');
  });
  it('should filter by tag', async () => {
    await generator(appTree, {
      targetVersion: 'patch',
      tags: 'tag2',
    });
    expect(JSON.parse(appTree.read('apps/app/package.json').toString()).version).toBe('1.0.1');
    expect(JSON.parse(appTree.read('packages/lib/package.json').toString()).version).toBe('1.0.1');
    expect(JSON.parse(appTree.read('packages/lib2/package.json').toString()).version).toBe('2.0.0');
  });

  it('should fail to set non-semver', async () => {
    const gen = await generator(appTree, {
      targetVersion: 'not-semver',
    }).catch(() => 'failed');
    expect(gen).toBe('failed');
  });
  it('should fail to set version lower than the existing version', async () => {
    const gen = await generator(appTree, {
      targetVersion: '1.0.1',
    }).catch(() => 'failed');
    expect(gen).toBe('failed');
  });
});

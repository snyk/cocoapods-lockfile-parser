#!/usr/bin/env node_modules/.bin/ts-node
// Shebang is required, and file *has* to be executable: chmod +x file.test.js
// See: https://github.com/tapjs/node-tap/issues/313#issuecomment-250067741
// tslint:disable:max-line-length
// tslint:disable:object-literal-key-quotes
import { test } from 'tap';
import * as fs from 'fs';
import * as path from 'path';
import LockfileParser from '../../lib';

const regenerateFixtures = process.env.REGENERATE == 'true';

function fixtureDir(dir: string): string {
  return `${__dirname}/fixtures/${dir}`;
}

function parse(dir: string): object {
  const filePath = path.join(fixtureDir(dir), 'Podfile.lock');
  return LockfileParser.readFileSync(filePath)
    .toDepGraph()
    .toJSON();
}

function load(dir: string): object {
  const filePath = path.join(fixtureDir(dir), 'dep-graph.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fixtureTest(description, dir): void {
  test(description, async (t) => {
    const expectedDepGraph = load(dir);
    const depGraph = parse(dir);
    if (regenerateFixtures) {
      const filePath = path.join(fixtureDir(dir), 'dep-graph.json');
      fs.writeFileSync(filePath, JSON.stringify(depGraph), {
        encoding: 'utf8',
      });

      t.false(
        regenerateFixtures,
        'Fixtures were regenerated, so nothing was actually tested'
      );
    } else {
      t.deepEqual(depGraph, expectedDepGraph, 'Graph generated as expected');
    }
  });
}

fixtureTest('Parse eigen’s Podfile.lock', 'eigen');

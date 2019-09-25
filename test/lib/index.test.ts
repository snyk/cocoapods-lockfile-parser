import * as fs from 'fs';
import * as path from 'path';
import { DepGraph, createFromJSON } from '@snyk/dep-graph';
import { LockfileParser } from '../../lib';

const regenerateFixtures = process.env.REGENERATE == 'true';

function fixtureDir(dir: string): string {
  return `${__dirname}/fixtures/${dir}`;
}

async function parse(dir: string): Promise<DepGraph> {
  const filePath = path.join(fixtureDir(dir), 'Podfile.lock');
  const parser = await LockfileParser.readFile(filePath);
  return parser.toDepGraph();
}

function load(dir: string): DepGraph {
  const filePath = path.join(fixtureDir(dir), 'dep-graph.json');
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return createFromJSON(json);
}

function fixtureTest(description: string, dir: string): void {
  test(description, async () => {
    const expectedDepGraph = load(dir);
    const depGraph = await parse(dir);
    if (regenerateFixtures) {
      const filePath = path.join(fixtureDir(dir), 'dep-graph.json');
      fs.writeFileSync(filePath, JSON.stringify(depGraph, null, 2), {
        encoding: 'utf8',
      });

      throw new Error(
        'Fixtures were regenerated, so nothing was actually tested'
      );
    } else {
      // JSON deep-equals
      expect(depGraph.toJSON()).toEqual(expectedDepGraph.toJSON());

      // Graph equals via DepGraph.equals
      expect(
        depGraph.equals(expectedDepGraph, { compareRoot: true })
      ).toBeTruthy();
    }
  });
}

fixtureTest('Parse eigen’s Podfile.lock', 'eigen');
fixtureTest(
  'CocoaPods’ integration spec install_new',
  'cp-integration-install_new'
);

test('LockfileParser.readFileSync reads eigen’s lockfile', () => {
  const filePath = path.join(fixtureDir('eigen'), 'Podfile.lock');
  const parser = LockfileParser.readFileSync(filePath);
  const depGraph = parser.toDepGraph();
  expect(depGraph.rootPkg.name).toBe('eigen');
  expect(depGraph.rootPkg.version).toBe('0.0.0');
  expect(depGraph.pkgManager.version).toBe('1.6.0.beta.1');
});

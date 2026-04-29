import * as path from 'path';
import { LockfileParser } from '../../lib';

function fixtureDir(dir: string): string {
  return `${__dirname}/fixtures/${dir}`;
}

describe('YAML 1.1 scalar coercion in lockfile labels', () => {
  describe('branch_underscore_yaml_coercion fixture', () => {
    // The fixture's Podfile.lock contains:
    //   EXTERNAL SOURCES:
    //     AFNetworkActivityLogger:
    //       :branch: 3_0_0
    //
    // `js-yaml` 3.x parses YAML 1.1 Core schema, where `_` is a digit
    // separator inside numeric scalars. Without coercion, `:branch: 3_0_0`
    // is loaded as the integer `300` and would leak into the depgraph
    // label as a number, even though the TypeScript type declares it `string`.
    const filePath = path.join(
      fixtureDir('branch_underscore_yaml_coercion'),
      'Podfile.lock'
    );

    test('externalSourceBranch is the original string `3_0_0`', () => {
      const parser = LockfileParser.readFileSync(filePath);
      const dg = parser.toDepGraph().toJSON();
      const node = dg.graph.nodes.find(
        (n) => n.nodeId === 'AFNetworkActivityLogger'
      );
      expect(node).toBeDefined();
      expect(node!.info!.labels!.externalSourceBranch).toBe('3_0_0');
      expect(typeof node!.info!.labels!.externalSourceBranch).toBe('string');
    });

    test('checkoutOptionsCommit survives as the original SHA string', () => {
      const parser = LockfileParser.readFileSync(filePath);
      const dg = parser.toDepGraph().toJSON();
      const node = dg.graph.nodes.find(
        (n) => n.nodeId === 'AFNetworkActivityLogger'
      );
      expect(node!.info!.labels!.checkoutOptionsCommit).toBe(
        'b7cce59a369788c409d218e8dab7f381a858cee4'
      );
      expect(typeof node!.info!.labels!.checkoutOptionsCommit).toBe('string');
    });
  });

  describe('synthetic lockfiles with YAML-1.1-coercible scalars', () => {
    function lockfileWithBranch(branch: string): string {
      return [
        'PODS:',
        '  - SomePod (1.0.0)',
        'DEPENDENCIES:',
        '  - SomePod (from `https://example.com/SomePod.git`, branch `' +
          branch +
          '`)',
        'EXTERNAL SOURCES:',
        '  SomePod:',
        '    :git: https://example.com/SomePod.git',
        '    :branch: ' + branch,
        'SPEC CHECKSUMS:',
        '  SomePod: 0000000000000000000000000000000000000000',
        'COCOAPODS: 1.15.2',
        '',
      ].join('\n');
    }

    const cases: Array<[string, string]> = [
      ['underscored numeric (the AFNetworkActivityLogger case)', '3_0_0'],
      ['plain integer', '300'],
      ['floating-point-looking', '1.0'],
      ['boolean yes', 'yes'],
      ['boolean no', 'no'],
      ['boolean true', 'true'],
      ['null literal', 'null'],
      ['hex integer', '0x1A'],
      ['octal integer', '0755'],
      ['ISO date', '2024-01-01'],
      ['infinity', '.inf'],
      ['not-a-number', '.nan'],
    ];

    test.each(cases)(
      'branch name `%s` (=%s) round-trips as a string',
      (_label, branch) => {
        const parser = LockfileParser.readContents(lockfileWithBranch(branch), {
          name: 'synthetic',
          version: '0.0.0',
        });
        const dg = parser.toDepGraph().toJSON();
        const node = dg.graph.nodes.find((n) => n.nodeId === 'SomePod');
        expect(node).toBeDefined();
        expect(node!.info!.labels!.externalSourceBranch).toBe(branch);
        expect(typeof node!.info!.labels!.externalSourceBranch).toBe('string');
      }
    );
  });
});

import {
  pkgInfoFromDependencyString,
  pkgInfoFromSpecificationString,
  rootSpecName,
} from '../../lib/utils';

describe('pkgInfoFromSpecificationString', () => {
  test('rootspec', () => {
    expect(pkgInfoFromSpecificationString('Adjust (4.17.1)')).toEqual({
      name: 'Adjust',
      version: '4.17.1',
    });
  });

  test('subspec', () => {
    expect(pkgInfoFromSpecificationString('Adjust/Core (4.17.1)')).toEqual({
      name: 'Adjust/Core',
      version: '4.17.1',
    });
  });

  test('no version', () => {
    expect(pkgInfoFromSpecificationString('Adjust')).toEqual({
      name: 'Adjust',
      version: undefined,
    });
  });

  test('invalid', () => {
    expect(() => pkgInfoFromSpecificationString('(4.17.1)')).toThrow();
    expect(() => pkgInfoFromSpecificationString('() (4.17.1)')).toThrow();
    expect(() => pkgInfoFromSpecificationString('Adjust ()')).toThrow();
  });
});

describe('pkgInfoFromDependencyString', () => {
  test('rootspec', () => {
    expect(pkgInfoFromDependencyString('Adjust (4.17.1)')).toEqual({
      name: 'Adjust',
      version: '4.17.1',
    });
  });

  test('subspec', () => {
    expect(pkgInfoFromDependencyString('Adjust/Core (4.17.1)')).toEqual({
      name: 'Adjust/Core',
      version: '4.17.1',
    });
  });

  test('no version', () => {
    expect(pkgInfoFromDependencyString('Adjust')).toEqual({
      name: 'Adjust',
      version: undefined,
    });
  });

  test('with logical operator', () => {
    expect(pkgInfoFromDependencyString('ReactiveObjC (~> 2.0)')).toEqual({
      name: 'ReactiveObjC',
      version: '~> 2.0',
    });
  });

  test('with external source', () => {
    expect(
      pkgInfoFromSpecificationString(
        'Pulley (from `https://github.com/l2succes/Pulley.git`, branch `master`)'
      )
    ).toEqual({
      name: 'Pulley',
      version: 'from `https://github.com/l2succes/Pulley.git`, branch `master`',
    });
  });

  test('invalid', () => {
    expect(() => pkgInfoFromSpecificationString('(4.17.1)')).toThrow();
    expect(() => pkgInfoFromSpecificationString('() (4.17.1)')).toThrow();
    expect(() => pkgInfoFromSpecificationString('Adjust ()')).toThrow();
  });
});

describe('rootSpecName', () => {
  test('rootspec', () => {
    expect(rootSpecName('Adjust')).toEqual('Adjust');
  });

  test('subspec', () => {
    expect(rootSpecName('Adjust/Core')).toEqual('Adjust');
  });

  test('nested subspec', () => {
    expect(
      rootSpecName('Adjust/Core/IsThisTheRealLife?/IsThisJustFantasy?')
    ).toEqual('Adjust');
  });
});

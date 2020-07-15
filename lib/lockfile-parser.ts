import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  PkgInfo,
  PkgManager,
  DepGraph,
  DepGraphBuilder,
} from '@snyk/dep-graph';
import {
  Lockfile,
  NodeInfoLabels,
  ExternalSourceInfo,
  CheckoutOptions,
} from './types';
import {
  pkgInfoFromDependencyString,
  pkgInfoFromSpecificationString,
  rootSpecName,
} from './utils';

export default class LockfileParser {
  public static async readFile(lockfilePath: string): Promise<LockfileParser> {
    const rootName = path.basename(path.dirname(path.resolve(lockfilePath)));
    return new Promise((resolve, reject) => {
      fs.readFile(lockfilePath, { encoding: 'utf8' }, (err, fileContents) => {
        if (err) {
          reject(err);
        }
        try {
          const parser = this.readContents(fileContents, {
            name: rootName,
            version: '0.0.0',
          });
          resolve(parser);
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  public static readFileSync(lockfilePath: string): LockfileParser {
    const fileContents = fs.readFileSync(lockfilePath, 'utf8');
    const rootName = path.basename(path.dirname(path.resolve(lockfilePath)));
    return this.readContents(fileContents, {
      name: rootName,
      version: '0.0.0',
    });
  }

  public static readContents(
    contents: string,
    rootPkgInfo?: PkgInfo
  ): LockfileParser {
    return new LockfileParser(yaml.safeLoad(contents) as Lockfile, rootPkgInfo);
  }

  private rootPkgInfo: PkgInfo | undefined = undefined;
  private internalData: Lockfile;

  public constructor(hash: Lockfile, rootPkgInfo?: PkgInfo) {
    this.rootPkgInfo = rootPkgInfo;
    this.internalData = hash;
  }

  public toDepGraph(): DepGraph {
    const builder = new DepGraphBuilder(this.pkgManager, this.rootPkgInfo);

    const allDeps: { [key: string]: PkgInfo[] } = {};

    // Add all package nodes first, but collect dependencies
    this.internalData.PODS.forEach((elem) => {
      let pkgInfo: PkgInfo;
      let pkgDeps: PkgInfo[];
      if (typeof elem === 'string') {
        // When there are NO dependencies. This equals in yaml e.g.
        //    - Expecta (1.0.5)
        pkgInfo = pkgInfoFromSpecificationString(elem);
        pkgDeps = [];
      } else {
        // When there are dependencies. This equals in yaml e.g.
        //    - React/Core (0.59.2):
        //      - yoga (= 0.59.2.React)
        const objKey = Object.keys(elem)[0];
        pkgInfo = pkgInfoFromSpecificationString(objKey);
        pkgDeps = elem[objKey].map(pkgInfoFromDependencyString);
      }

      const nodeId = this.nodeIdForPkgInfo(pkgInfo);
      builder.addPkgNode(pkgInfo, nodeId, {
        labels: this.nodeInfoLabelsForPod(pkgInfo.name),
      });

      allDeps[nodeId] = pkgDeps;
    });

    // Connect explicitly in the manifest (`Podfile`)
    // declared dependencies to the root node.
    this.internalData.DEPENDENCIES.map(pkgInfoFromDependencyString).forEach(
      (pkgInfo) => {
        builder.connectDep(builder.rootNodeId, this.nodeIdForPkgInfo(pkgInfo));
      }
    );

    // Now we can start to connect dependencies
    Object.entries(allDeps).forEach(([nodeId, pkgDeps]) =>
      pkgDeps.forEach((pkgInfo) => {
        const depNodeId = this.nodeIdForPkgInfo(pkgInfo);
        if (!allDeps[depNodeId]) {
          // The pod is not a direct dependency of any targets of the integration,
          // which can happen for platform-specific transitives, when their platform
          // is not used in any target. (e.g. PromiseKit/UIKit is iOS-specific and is
          // a transitive of PromiseKit, but won't be included for a macOS project.)
          return;
        }
        builder.connectDep(nodeId, depNodeId);
      })
    );

    return builder.build();
  }

  /// CocoaPods guarantees that every pod is only present in one version,
  /// so we can use just the pod name as node ID.
  private nodeIdForPkgInfo(pkgInfo: PkgInfo): string {
    return pkgInfo.name;
  }

  /// Gathers relevant info from the lockfile and transform
  /// them into the expected labels data structure.
  private nodeInfoLabelsForPod(podName: string): NodeInfoLabels {
    let nodeInfoLabels: NodeInfoLabels = {
      checksum: this.checksumForPod(podName),
    };

    const repository = this.repositoryForPod(podName);
    if (repository) {
      nodeInfoLabels = {
        ...nodeInfoLabels,
        repository,
      };
    }

    const externalSourceInfo = this.externalSourceInfoForPod(podName);
    if (externalSourceInfo) {
      nodeInfoLabels = {
        ...nodeInfoLabels,
        externalSourcePodspec: externalSourceInfo[':podspec'],
        externalSourcePath: externalSourceInfo[':path'],
        externalSourceGit: externalSourceInfo[':git'],
        externalSourceTag: externalSourceInfo[':tag'],
        externalSourceCommit: externalSourceInfo[':commit'],
        externalSourceBranch: externalSourceInfo[':branch'],
      };
    }

    const checkoutOptions = this.checkoutOptionsForPod(podName);
    if (checkoutOptions) {
      nodeInfoLabels = {
        ...nodeInfoLabels,
        checkoutOptionsPodspec: checkoutOptions[':podspec'],
        checkoutOptionsPath: checkoutOptions[':path'],
        checkoutOptionsGit: checkoutOptions[':git'],
        checkoutOptionsTag: checkoutOptions[':tag'],
        checkoutOptionsCommit: checkoutOptions[':commit'],
        checkoutOptionsBranch: checkoutOptions[':branch'],
      };
    }

    // Sanitize labels by removing null fields
    // (as they don't survive a serialization/parse cycle and break tests)
    Object.entries(nodeInfoLabels).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        delete nodeInfoLabels[key];
      }
    });

    return nodeInfoLabels;
  }

  /// The checksum of the pod.
  private checksumForPod(podName: string): string {
    const rootName = rootSpecName(podName);
    return this.internalData['SPEC CHECKSUMS'][rootName];
  }

  /// This can be either an URL or the local repository name.
  private repositoryForPod(podName: string): string | undefined {
    // Older Podfile.lock might not have this section yet.
    const specRepos = this.internalData['SPEC REPOS'];
    if (!specRepos) {
      return undefined;
    }
    const rootName = rootSpecName(podName);
    const specRepoEntry = Object.entries(specRepos).find(([, deps]) =>
      (deps as string[]).includes(rootName)
    );
    if (specRepoEntry) {
      return specRepoEntry[0];
    }
    return undefined;
  }

  /// Extracts the external source info for a given pod, if there is any.
  private externalSourceInfoForPod(
    podName: string
  ): ExternalSourceInfo | undefined {
    // Older Podfile.lock might not have this section yet.
    const externalSources = this.internalData['EXTERNAL SOURCES'];
    if (!externalSources) {
      return undefined;
    }
    const externalSourceEntry = externalSources[rootSpecName(podName)];
    if (externalSourceEntry) {
      return externalSourceEntry;
    }
    return undefined;
  }

  /// Extracts the checkout options for a given pod, if there is any.
  private checkoutOptionsForPod(podName: string): CheckoutOptions | undefined {
    // Older Podfile.lock might not have this section yet.
    const checkoutOptions = this.internalData['CHECKOUT OPTIONS'];
    if (!checkoutOptions) {
      return undefined;
    }
    const checkoutOptionsEntry = checkoutOptions[rootSpecName(podName)];
    if (checkoutOptionsEntry) {
      return checkoutOptionsEntry;
    }
    return undefined;
  }

  private get repositories(): PkgManager['repositories'] {
    // Older Podfile.lock might not have this section yet.
    const specRepos = this.internalData['SPEC REPOS'];
    if (!specRepos) {
      return [];
    }
    return Object.keys(specRepos).map((nameOrUrl: string) => {
      return { alias: nameOrUrl };
    });
  }

  private get pkgManager(): PkgManager {
    return {
      name: 'cocoapods',
      version: this.cocoapodsVersion,
      repositories: this.repositories,
    };
  }

  /// The CocoaPods version encoded in the lockfile which was used to
  /// create this resolution.
  private get cocoapodsVersion(): string {
    return this.internalData.COCOAPODS || 'unknown';
  }

  /// The checksum of the Podfile, which was used when resolving this integration.
  /// - Note: this was not tracked by earlier versions of CocoaPods.
  public get podfileChecksum(): string | undefined {
    return this.internalData['PODFILE CHECKSUM'];
  }
}

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import {
  PkgInfo,
  PkgManager,
  DepGraph,
  DepGraphBuilder,
} from '@snyk/dep-graph';
import { Lockfile, NodeInfoLabels, ExternalSourceInfo } from './types';
import {
  pkgInfoFromDependencyString,
  pkgInfoFromSpecificationString,
  rootSpecName,
} from './utils';

export default class LockfileParser {
  public static readFileSync(path: string): LockfileParser {
    const fileContents = fs.readFileSync(path, 'utf8');
    return this.readContents(fileContents);
  }

  public static readContents(contents: string): LockfileParser {
    return new LockfileParser(yaml.safeLoad(contents));
  }

  private internalData: Lockfile;

  public constructor(hash: Lockfile) {
    this.internalData = hash;
  }

  public toDepGraph(): DepGraph {
    const builder = new DepGraphBuilder(this.pkgManager);

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

      const nodeId = pkgInfo.name;
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
        builder.connectDep(nodeId, this.nodeIdForPkgInfo(pkgInfo));
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
  private nodeInfoLabelsForPod(podName): NodeInfoLabels {
    let nodeInfoLabels: NodeInfoLabels = {};

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

    // Sanitize labels by removing null fields
    // (as they don't survive a serialization/parse cycle and break tests)
    Object.entries(nodeInfoLabels).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        delete nodeInfoLabels[key];
      }
    });

    return nodeInfoLabels;
  }

  /// This can be either an URL or the local repository name.
  private repositoryForPod(podName: string): string | undefined {
    const rootName = rootSpecName(podName);
    const specRepoEntry = Object.entries(this.internalData['SPEC REPOS']).find(
      ([, deps]) => (deps as string[]).includes(rootName)
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

  private get pkgManager(): PkgManager {
    return {
      name: 'CocoaPods',
      version: this.cocoapodsVersion,
      repositories: Object.keys(this.internalData['SPEC REPOS']).map(
        (nameOrUrl: string) => {
          return { alias: nameOrUrl };
        }
      ),
    };
  }

  /// The CocoaPods version encoded in the lockfile which was used to
  /// create this resolution.
  private get cocoapodsVersion(): string {
    return this.internalData.COCOAPODS || 'unknown';
  }
}

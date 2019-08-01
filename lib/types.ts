export interface NodeInfoLabels {
  // compatibility to @snyk/dep-graph.NodeInfo.labels
  [key: string]: string | undefined;

  repository?: string;

  // TODO: Support externalSource
  // TODO: Support checkoutOptions
  // TODO: Support checksum
}

/// This describes the structure of a `Podfile.lock`.
export interface Lockfile {
  PODS: PodEntry[];
  DEPENDENCIES: string[];
  'SPEC REPOS': {
    [key: string]: string[];
  };
  'SPEC CHECKSUMS': {
    [key: string]: string;
  };
  'PODFILE CHECKSUM'?: string;
  COCOAPODS?: string;
}

type PodEntry =
  | string
  | {
      [key: string]: string[];
    };

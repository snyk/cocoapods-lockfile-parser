export interface NodeInfoLabels {
  // compatibility to @snyk/dep-graph.NodeInfo.labels
  [key: string]: string | undefined;

  repository?: string;

  externalSourcePodspec?: string;
  externalSourcePath?: string;
  externalSourceGit?: string;
  externalSourceTag?: string;
  externalSourceCommit?: string;
  externalSourceBranch?: string;

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
  'EXTERNAL SOURCES'?: {
    [key: string]: ExternalSourceInfo;
  };
  'CHECKOUT OPTIONS'?: {
    [key: string]: CheckoutOptions;
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

export type ExternalSourceInfoKey =
  | 'podspec'
  | 'path'
  | 'git'
  | 'tag'
  | 'commit'
  | 'branch';
export type ExternalSourceInfo = {
  [K in ExternalSourceInfoKey]?: string;
};

export type CheckoutOptionKey = ExternalSourceInfoKey;
export type CheckoutOptions = {
  [K in CheckoutOptionKey]?: string;
};

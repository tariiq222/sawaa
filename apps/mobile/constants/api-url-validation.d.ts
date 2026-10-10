export interface ApiUrlResolutionEnv {
  configuredApiUrl?: string;
  easBuildProfile?: string;
  releaseEnvironment?: string;
  nodeEnv?: string;
}

export declare function assertProductionApiUrl(apiUrl: string): void;
export declare function resolveApiUrl(env: ApiUrlResolutionEnv): string;
export declare function resolveIosBuildNumber(value?: string): string | undefined;

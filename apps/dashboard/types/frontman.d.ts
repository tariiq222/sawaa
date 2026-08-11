declare module '@frontman-ai/nextjs' {
  import type { NextRequest, NextResponse } from 'next/server';

  export interface FrontmanConfig {
    projectRoot?: string;
    sourceRoot?: string;
    basePath?: string;
    host?: string;
    serverName?: string;
    serverVersion?: string;
    clientUrl?: string;
    clientCssUrl?: string;
    entrypointUrl?: string;
    isLightTheme?: boolean;
    isDev?: boolean;
  }

  export function createMiddleware(
    config?: FrontmanConfig,
  ): (req: NextRequest) => Promise<NextResponse | undefined>;
}

declare module '@frontman-ai/nextjs/Instrumentation' {
  export function setup(): unknown[];
}

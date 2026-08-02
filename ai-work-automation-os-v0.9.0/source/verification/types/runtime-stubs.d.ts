declare const process: {
  env: Record<string, string | undefined>;
  cwd(): string;
};

declare namespace React {
  type ReactNode = unknown;
}

declare namespace JSX {
  interface IntrinsicElements { [name: string]: any }
  interface Element {}
}

declare module "react" {
  export type FormEvent = { preventDefault(): void };
  export type ReactNode = unknown;
  export function useState<T>(initial: T): [T, (value: T | ((current: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), dependencies?: readonly unknown[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, dependencies: readonly unknown[]): T;
  export function useMemo<T>(factory: () => T, dependencies: readonly unknown[]): T;
}

declare module "next/link" { const Link: (props: any) => JSX.Element; export default Link; }
declare module "next/navigation" {
  export function useRouter(): { push(path: string): void; replace(path: string): void; refresh(): void };
  export function redirect(path: string): never;
}
declare module "next/server" {
  export class NextRequest extends Request {}
}
declare module "next" {
  export type Metadata = Record<string, unknown>;
  export type NextConfig = Record<string, any>;
}

declare module "@prisma/client" {
  export namespace Prisma { type TransactionClient = any; }
  export class PrismaClient {
    [key: string]: any;
    constructor(options?: any);
    $transaction: any;
    $disconnect(): Promise<void>;
  }
}

declare module "node:crypto" {
  export function createHash(algorithm: string): any;
  export function randomUUID(): string;
}
declare module "node:fs" {
  export const existsSync: any;
  export const statSync: any;
}
declare module "node:path" { export const resolve: any; }

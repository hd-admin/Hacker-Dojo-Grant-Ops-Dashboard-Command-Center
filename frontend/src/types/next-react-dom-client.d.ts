declare module 'next/dist/compiled/react-dom/client' {
  export interface Root {
    render(children: unknown): void;
    unmount(): void;
  }

  export interface RootOptions {
    onRecoverableError?: (error: unknown) => void;
    identifierPrefix?: string;
  }

  export function createRoot(container: Element | DocumentFragment, options?: RootOptions): Root;
  export function hydrateRoot(
    container: Element | DocumentFragment,
    initialChildren: unknown,
    options?: RootOptions,
  ): Root;
  export const version: string;
}

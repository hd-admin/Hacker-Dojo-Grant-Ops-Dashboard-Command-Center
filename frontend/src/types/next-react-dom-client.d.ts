declare module 'next/dist/compiled/react-dom/client' {
  export function createRoot(
    container: Element | DocumentFragment,
    options?: { hydrate?: boolean },
  ): {
    render(children: React.ReactNode): void;
    unmount(): void;
  };
}

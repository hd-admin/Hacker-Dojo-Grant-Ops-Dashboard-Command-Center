declare module 'pdf-parse' {
  interface PDFParseResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    text: string;
    version: string;
  }

  function PDFParse(dataBuffer: Buffer, options?: { max?: number; version?: string }): Promise<PDFParseResult>;

  export = PDFParse;
}

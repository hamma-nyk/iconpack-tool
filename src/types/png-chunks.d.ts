declare module "png-chunks-extract" {
  export interface PNGChunk {
    name: string;
    data: Uint8Array;
  }

  export default function extract(buffer: Uint8Array | ArrayBuffer): PNGChunk[];
}

declare module "png-chunks-encode" {
  import { PNGChunk } from "png-chunks-extract";
  export default function encode(chunks: PNGChunk[]): Uint8Array;
}

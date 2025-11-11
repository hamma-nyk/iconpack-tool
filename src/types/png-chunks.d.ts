declare module "png-chunks-extract" {
  export interface PNGChunk {
    name: string;
    data: Buffer;
  }

  export default function extract(buffer: Buffer): PNGChunk[];
}

declare module "png-chunks-encode" {
  import { PNGChunk } from "png-chunks-extract";
  export default function encode(chunks: PNGChunk[]): Buffer;
}

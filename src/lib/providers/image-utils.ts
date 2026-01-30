/**
 * Get image dimensions from a buffer by parsing headers
 */
export function getImageDimensions(buffer: Buffer): { width: number; height: number } {
  // Check for PNG signature
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    // PNG: dimensions are at bytes 16-23 in IHDR chunk
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  // Check for JPEG signature
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    // JPEG: need to find SOF0 or SOF2 marker
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = buffer[offset + 1];

      // SOF0 (0xC0) or SOF2 (0xC2) - Start of Frame markers
      if (marker === 0xc0 || marker === 0xc2) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }

      // Skip to next marker
      if (marker === 0xd8 || marker === 0xd9) {
        // SOI or EOI - no length
        offset += 2;
      } else {
        // Read segment length and skip
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }
  }

  // Check for WebP signature
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    // WebP VP8 or VP8L
    if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38) {
      if (buffer[15] === 0x20) {
        // VP8 lossy
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      } else if (buffer[15] === 0x4c) {
        // VP8L lossless
        const bits = buffer.readUInt32LE(21);
        const width = (bits & 0x3fff) + 1;
        const height = ((bits >> 14) & 0x3fff) + 1;
        return { width, height };
      }
    }
  }

  // Default fallback
  return { width: 1024, height: 1024 };
}

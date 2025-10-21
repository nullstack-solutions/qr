const CHUNK_SIZE = 0x8000;

export function bytesToBinaryString(bytes: Uint8Array): string {
  let result = "";
  for (let index = 0; index < bytes.length; index += CHUNK_SIZE) {
    const chunk = bytes.subarray(index, index + CHUNK_SIZE);
    result += String.fromCharCode(...chunk);
  }
  return result;
}

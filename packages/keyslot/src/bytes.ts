/**
 * WebCrypto's types want ArrayBuffer-backed views; libsodium and callers hand over
 * `Uint8Array<ArrayBufferLike>`. Pass through when already ArrayBuffer-backed, else copy.
 */
export function buf(view: Uint8Array): Uint8Array<ArrayBuffer> {
  return view.buffer instanceof ArrayBuffer
    ? (view as Uint8Array<ArrayBuffer>)
    : new Uint8Array(view)
}

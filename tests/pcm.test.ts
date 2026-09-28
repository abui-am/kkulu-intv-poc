import { describe, expect, it } from "vitest";
import { takeCompletePcm } from "@/lib/voice/pcm";

describe("pcm stream assembly", () => {
  it("keeps a trailing byte until the next chunk completes the sample", () => {
    const first = takeCompletePcm(new Uint8Array(), new Uint8Array([0x34, 0x12, 0xff]));
    expect(Array.from(first.samples)).toEqual([0x1234]);
    expect(Array.from(first.rest)).toEqual([0xff]);

    const second = takeCompletePcm(first.rest, new Uint8Array([0x7f]));
    expect(Array.from(second.samples)).toEqual([0x7fff]);
    expect(second.rest.length).toBe(0);
  });

  it("reads little-endian signed samples", () => {
    const taken = takeCompletePcm(new Uint8Array(), new Uint8Array([0x00, 0x80]));
    expect(Array.from(taken.samples)).toEqual([-32768]);
  });
});
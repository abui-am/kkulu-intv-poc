import { loadRnnoise, RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";

export type DenoisedMicrophone = {
  stream: MediaStream;
  context: AudioContext;
  close: () => void;
};

export async function openDenoisedMicrophone(): Promise<DenoisedMicrophone> {
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const context = new AudioContext({ sampleRate: 48000 });
  if (context.state === "suspended") await context.resume();
  await context.audioWorklet.addModule("/rnnoise/workletProcessor.js");
  const wasmBinary = await loadRnnoise({
    url: "/rnnoise/rnnoise.wasm",
    simdUrl: "/rnnoise/rnnoise_simd.wasm",
  });
  const source = context.createMediaStreamSource(raw);
  const suppressor = new RnnoiseWorkletNode(context, { maxChannels: 1, wasmBinary });
  const destination = context.createMediaStreamDestination();
  source.connect(suppressor);
  suppressor.connect(destination);
  return {
    stream: destination.stream,
    context,
    close: () => {
      suppressor.disconnect();
      suppressor.destroy();
      source.disconnect();
      raw.getTracks().forEach((track) => track.stop());
      void context.close();
    },
  };
}

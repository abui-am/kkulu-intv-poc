import { SAMPLE_HEIGHT, SAMPLE_WIDTH } from "@/lib/screen/config";

export function sampleLuminance(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Uint8Array | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  context.drawImage(video, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const image = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  const luminance = new Uint8Array(SAMPLE_WIDTH * SAMPLE_HEIGHT);
  for (let pixel = 0, index = 0; index < image.data.length; index += 4, pixel += 1) {
    luminance[pixel] = Math.round(
      image.data[index] * 0.299 +
        image.data[index + 1] * 0.587 +
        image.data[index + 2] * 0.114,
    );
  }
  return luminance;
}

export function captureJpeg(video: HTMLVideoElement, maxWidth = 1280): string | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

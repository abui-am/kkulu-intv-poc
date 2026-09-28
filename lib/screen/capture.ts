import { SAMPLE_HEIGHT, SAMPLE_WIDTH } from "@/lib/screen/config";

export function sampleLuminance(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Uint8Array | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  return sampleLuminanceFromSource(video, video.videoWidth, video.videoHeight, canvas);
}

export function sampleLuminanceFromSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  canvas: HTMLCanvasElement,
): Uint8Array | null {
  if (sourceWidth === 0 || sourceHeight === 0) return null;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  canvas.width = SAMPLE_WIDTH;
  canvas.height = SAMPLE_HEIGHT;
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
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

const JPEG_MAX_WIDTH = 768;
const JPEG_QUALITY = 0.6;

type FrameCrop = { sx: number; sy: number; sw: number; sh: number };

export function captureJpeg(video: HTMLVideoElement, product?: HTMLElement | null): string | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const crop = product ? productRegion(video, product) : null;
  if (crop) return jpegFromRegion(video, crop);
  return jpegFromSource(video, video.videoWidth, video.videoHeight, JPEG_MAX_WIDTH);
}

function productRegion(video: HTMLVideoElement, product: HTMLElement): FrameCrop | null {
  const rect = product.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return null;
  const dpr = window.devicePixelRatio || 1;
  const chromeX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
  const chromeY = Math.max(0, window.outerHeight - window.innerHeight);
  const sx = (window.screenX + chromeX + rect.left) * dpr;
  const sy = (window.screenY + chromeY + rect.top) * dpr;
  const sw = rect.width * dpr;
  const sh = rect.height * dpr;
  if (sx < -1 || sy < -1 || sx + sw > video.videoWidth + 2 || sy + sh > video.videoHeight + 2) return null;
  const left = Math.max(0, sx);
  const top = Math.max(0, sy);
  return {
    sx: left,
    sy: top,
    sw: Math.min(sw, video.videoWidth - left),
    sh: Math.min(sh, video.videoHeight - top),
  };
}

function jpegFromRegion(source: CanvasImageSource, region: FrameCrop): string | null {
  const scale = Math.min(1, JPEG_MAX_WIDTH / region.sw);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.sw * scale));
  canvas.height = Math.max(1, Math.round(region.sh * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(source, region.sx, region.sy, region.sw, region.sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export function jpegFromSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxWidth = JPEG_MAX_WIDTH,
): string | null {
  if (sourceWidth === 0 || sourceHeight === 0) return null;
  const scale = Math.min(1, maxWidth / sourceWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

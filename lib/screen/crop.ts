type CropTargetConstructor = {
  fromElement: (element: Element) => Promise<unknown>;
};

type CroppableTrack = MediaStreamTrack & {
  cropTo?: (target: unknown) => Promise<void>;
  restrictTo?: (target: unknown) => Promise<void>;
};

type RestrictionTargetConstructor = {
  fromElement: (element: Element) => Promise<unknown>;
};

type CurrentTabCaptureOptions = DisplayMediaStreamOptions & {
  preferCurrentTab?: boolean;
  selfBrowserSurface?: "include" | "exclude";
  monitorTypeSurfaces?: "include" | "exclude";
  surfaceSwitching?: "include" | "exclude";
};

function cropTargetConstructor(): CropTargetConstructor | null {
  const candidate = (globalThis as { CropTarget?: CropTargetConstructor }).CropTarget;
  return candidate?.fromElement ? candidate : null;
}

function restrictionTargetConstructor(): RestrictionTargetConstructor | null {
  const candidate = (globalThis as { RestrictionTarget?: RestrictionTargetConstructor }).RestrictionTarget;
  return candidate?.fromElement ? candidate : null;
}

export function canCropCapture(): boolean {
  return restrictionTargetConstructor() !== null || cropTargetConstructor() !== null;
}

export function entireScreenCaptureOptions(): CurrentTabCaptureOptions {
  return {
    video: { displaySurface: "monitor" } as MediaTrackConstraints,
    audio: false,
    monitorTypeSurfaces: "include",
    selfBrowserSurface: "exclude",
    surfaceSwitching: "include",
  };
}

export async function cropTrackToElement(track: MediaStreamTrack, element: HTMLElement): Promise<void> {
  const surface = track.getSettings().displaySurface;
  if (surface && surface !== "browser") {
    throw new Error("Choose This Tab in the share dialog.");
  }
  const croppable = track as CroppableTrack;
  const RestrictionTarget = restrictionTargetConstructor();
  if (RestrictionTarget && typeof croppable.restrictTo === "function") {
    try {
      const target = await RestrictionTarget.fromElement(element);
      await croppable.restrictTo(target);
      return;
    } catch {
      // Region capture is the fallback when element capture rejects this track.
    }
  }
  const CropTarget = cropTargetConstructor();
  if (!CropTarget || typeof croppable.cropTo !== "function") {
    throw new Error("Chrome is required to capture just the product.");
  }
  const target = await CropTarget.fromElement(element);
  await croppable.cropTo(target);
}

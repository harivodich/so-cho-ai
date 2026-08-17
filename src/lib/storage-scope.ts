const DEVICE_SCOPE = "device";

export function storageScope(scope?: string | null): string {
  const value = scope?.trim();
  return value ? value : DEVICE_SCOPE;
}

export function scopedStorageKey(baseKey: string, scope?: string | null): string {
  return `${baseKey}.${encodeURIComponent(storageScope(scope))}`;
}

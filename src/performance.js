import { formatUnits } from "./fixed.js";

export function calculateShareValueChange(startAssetsRaw, endAssetsRaw, assetDecimals, elapsedSeconds, precision = 6) {
  const start = BigInt(startAssetsRaw);
  const end = BigInt(endAssetsRaw);
  const elapsed = BigInt(elapsedSeconds);
  if (start <= 0n) throw new Error("Historical fixed-share asset value must be positive.");
  if (elapsed <= 0n) throw new Error("Observed performance interval must be positive.");
  const delta = end - start;
  const percentScaled = delta * 100n * (10n ** BigInt(precision)) / start;
  return {
    startAssetsRaw: start.toString(),
    endAssetsRaw: end.toString(),
    deltaAssetsRaw: delta.toString(),
    assetDecimals,
    startAssetsFormatted: formatUnits(start, assetDecimals, assetDecimals),
    endAssetsFormatted: formatUnits(end, assetDecimals, assetDecimals),
    deltaAssetsFormatted: formatUnits(delta, assetDecimals, assetDecimals),
    percentScaledRaw: percentScaled.toString(),
    percentDecimals: precision,
    percentFormatted: formatUnits(percentScaled, precision, precision),
    elapsedSeconds: elapsed.toString()
  };
}

export function formatElapsed(secondsInput) {
  let seconds = BigInt(secondsInput);
  if (seconds < 0n) throw new Error("Elapsed time cannot be negative.");
  const days = seconds / 86400n; seconds %= 86400n;
  const hours = seconds / 3600n; seconds %= 3600n;
  const minutes = seconds / 60n; seconds %= 60n;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

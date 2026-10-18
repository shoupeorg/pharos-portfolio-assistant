export function assertAddress(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error("Enter a valid 20-byte public EVM address.");
  return value.toLowerCase();
}

export function pow10(decimals) { return 10n ** BigInt(decimals); }

export function formatUnits(value, decimals, maxFraction = decimals) {
  const n = BigInt(value);
  const negative = n < 0n;
  const abs = negative ? -n : n;
  const base = pow10(decimals);
  const whole = abs / base;
  let fraction = (abs % base).toString().padStart(decimals, "0");
  if (maxFraction < decimals) fraction = fraction.slice(0, maxFraction);
  fraction = fraction.replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function encodeAddressCall(selector, address) {
  return selector + assertAddress(address).slice(2).padStart(64, "0");
}

export function encodeUintCall(selector, value) {
  const n = BigInt(value);
  if (n < 0n) throw new Error("Unsigned ABI argument cannot be negative.");
  return selector + n.toString(16).padStart(64, "0");
}

export function decodeUint(raw, label = "uint256") {
  if (typeof raw !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new Error(`${label} returned invalid ABI data.`);
  return BigInt(raw);
}

export function decodeAddress(raw, label = "address") {
  if (typeof raw !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(raw)) throw new Error(`${label} returned invalid ABI data.`);
  return `0x${raw.slice(-40)}`.toLowerCase();
}

const twoDpFormatter = Intl.NumberFormat("en-US", {
  style: "decimal",
  maximumFractionDigits: 2,
});

export function formatNumber(balance: bigint, decimals: number) {
  // If over 1T, display to 2dp, eg 1.09T
  if (balance > Math.pow(10, decimals + 12)) {
    const formattedNumber = twoDpFormatter.format(
      // @ts-expect-error formatter supports this
      `${balance}E-${decimals + 12}`
    );
    return `${formattedNumber}T`;
  }

  // If over 1B, display to 2dp, eg 1.09B
  if (balance > Math.pow(10, decimals + 9)) {
    const formattedNumber = twoDpFormatter.format(
      // @ts-expect-error formatter supports this
      `${balance}E-${decimals + 9}`
    );
    return `${formattedNumber}B`;
  }

  // If over 1M, display to 2dp, eg 1.09M
  if (balance > Math.pow(10, decimals + 6)) {
    const formattedNumber = twoDpFormatter.format(
      // @ts-expect-error formatter supports this
      `${balance}E-${decimals + 6}`
    );
    return `${formattedNumber}M`;
  }

  if (balance === 0n) return `0`;

  // If under 0.00001, just show <0.00001
  if (balance < Math.pow(10, decimals - 5)) {
    return `<0.00001`;
  }

  // For all other cases, display up to 5 decimals
  const formatter = Intl.NumberFormat("en-US", {
    style: "decimal",
    maximumFractionDigits: Math.min(5, decimals),
  });

  // @ts-expect-error formatter supports this
  return formatter.format(`${balance}E-${decimals}`);
}

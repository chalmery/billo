// 银行中文名 → 卡面英文水印缩写，未知则取英文/字母回退
const BANK_ABBR: Record<string, string> = {
  "招商银行": "CMB",
};

export function bankAbbr(bank: string): string {
  if (BANK_ABBR[bank]) return BANK_ABBR[bank];
  const ascii = bank.replace(/[^a-zA-Z]/g, "");
  return (ascii || bank).slice(0, 4).toUpperCase();
}

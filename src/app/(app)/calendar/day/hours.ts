export const HOUR_START = 6; // 6am
export const HOUR_END = 22; // 10pm row (last row covers 10-11pm)

export function hourLabel(hour: number) {
  const period = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${period}`;
}

import { roundMoney } from "@/lib/labels";

export function takeHome(scale: number, addon: number) {
  return roundMoney(Number(scale || 0) + Number(addon || 0));
}

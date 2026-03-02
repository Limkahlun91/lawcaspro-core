export function platformFeeDeduction(amount: number): number {
  if (amount <= 0) return 0
  if (amount > 50) return 3
  if (amount >= 20) return 2
  return 1
}

export function netRunnerPayout(amount: number): number {
  const deduction = platformFeeDeduction(amount)
  return amount - deduction
}

export type TaxType = 'SST' | 'GST'

export interface InvoiceItem {
  id: string
  description: string
  amount: number
  isTaxable: boolean
  category: 'Fee' | 'Disbursement'
}

export function taxRate(type: TaxType): number {
  return type === 'SST' ? 0.08 : 0.06
}

// Formula: Total = Taxable Items + (Taxable Items * Rate) + Non-Taxable Items
export function calcInvoice(items: InvoiceItem[], type: TaxType) {
  const rate = taxRate(type)
  
  const taxableTotal = items
    .filter(i => i.isTaxable)
    .reduce((sum, i) => sum + i.amount, 0)
    
  const nonTaxableTotal = items
    .filter(i => !i.isTaxable)
    .reduce((sum, i) => sum + i.amount, 0)

  const tax = +(taxableTotal * rate).toFixed(2)
  const subtotal = +(taxableTotal + nonTaxableTotal).toFixed(2)
  const total = +(subtotal + tax).toFixed(2)
  
  return { rate, tax, subtotal, total, taxableTotal, nonTaxableTotal }
}

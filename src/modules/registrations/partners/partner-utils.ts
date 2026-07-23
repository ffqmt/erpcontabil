export function formatDocument(doc: string | null, type?: string | null): string {
  if (!doc) return '—'
  const clean = doc.replace(/\D/g, '')

  if (type === 'CNPJ' || clean.length === 14) {
    if (clean.length !== 14) return doc
    return `${clean.substring(0, 2)}.${clean.substring(2, 5)}.${clean.substring(5, 8)}/${clean.substring(8, 12)}-${clean.substring(12, 14)}`
  }

  if (type === 'CPF' || clean.length === 11) {
    if (clean.length !== 11) return doc
    return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`
  }

  return doc
}

export interface PartnerRoleLabel {
  key: 'is_customer' | 'is_supplier' | 'is_carrier' | 'is_employee'
  label: string
}

export const PARTNER_ROLE_LABELS: PartnerRoleLabel[] = [
  { key: 'is_customer', label: 'Cliente' },
  { key: 'is_supplier', label: 'Fornecedor' },
  { key: 'is_carrier', label: 'Transportadora' },
  { key: 'is_employee', label: 'Colaborador' }
]

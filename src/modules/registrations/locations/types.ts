export interface State {
  id: string
  uf: string
  name: string
  ibge_code: string | null
}

export interface Municipality {
  id: string
  state_id: string
  uf: string
  name: string
  ibge_code: string | null
}

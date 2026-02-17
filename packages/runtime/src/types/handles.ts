export type HandleDataType = 'image' | 'data'

export interface HandleDef {
  id: string
  direction: 'source' | 'target'
  dataType: HandleDataType
  multi?: boolean
  label?: string
}

import { ContractParameterType, InputMap } from "../inputs/types"

import { Template, TemplateClause } from "ionio-bitcoin"

export interface SourceMap {
  [s: string]: string
}

export interface Param {
  name: string
  type: ContractParameterType
}

export interface HashCall {
  hashType: string
  arg: string
  argType: string
}

export interface ValueInfo {
  name: string
  program?: string
  amount?: string
}

export interface AssetInfo {
  name: string
  asset: string
}

export interface ClauseInfo {
  name: string
  args: Param[]
  mintimes: string[]
  maxtimes: string[]
  hashCalls: HashCall[]
  valueInfo: ValueInfo[]
}

export interface TemplateState {
  sourceMap: SourceMap
  idList: string[]
  source: string
  inputMap?: InputMap
  compiled?: Template
  showLockInputErrors: boolean
  error?
}

export { Template, TemplateClause }

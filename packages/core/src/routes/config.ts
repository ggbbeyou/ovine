/**
 * App route 配置
 * TODO: 添加 unit test
 */

import { mapTree, eachTree } from 'amis/lib/utils/helper'
import { cloneDeep, last, pick, map, get, omitBy } from 'lodash'

import { strDelimiter, message } from '@/constants'
import { publish } from '@/utils/message'
import { ObjectOf } from '@/utils/types'

import { getPagePreset } from './exports'
import { RouteItem } from './types'

type StoreType = {
  routesConfig: RouteItem[]
  actionAddrMap: ObjectOf<{
    label: string
    api: string
    actionDesc?: string
  }>
}
const store: StoreType = {
  routesConfig: [],
  actionAddrMap: {},
}

// 解析配置的路由数据
// 1. 根据 nodePath 生成默认 path 路径值
const resolveConfig = (nodes: RouteItem[]) => {
  return mapTree(nodes, (item, _, __, itemNodes) => {
    const { path, limitLabel, label, nodePath, children, pathToComponent } = item
    const lastItem = last(itemNodes)
    item.nodePath = `${lastItem?.nodePath || ''}/${nodePath}`.replace(/(\/\/)/g, '/')
    item.nodeLabel = `${lastItem?.label || lastItem?.limitLabel || ''}/${label || limitLabel || ''}`

    if (!path && (pathToComponent || (!children && !pathToComponent))) {
      item.path = item.nodePath
    }

    return item
  })
}

// 当未设置 limits 字段时，会有 undefined 显示情况
const resolePreset = (config: RouteItem[]) => {
  eachTree(config, (item) => {
    const { nodePath, nodeLabel } = item
    const preset = getPagePreset(item) || pick(item, ['apis', 'limits'])

    const { limits, apis } = preset

    // 将 preset 配置的 apis， 添加到权限配置表中
    if (!apis) {
      return
    }

    map(apis, (apiItem) => {
      const { limits: apiNeeds, actionDesc, actionAddr } = apiItem
      const presetApiNeeds = typeof apiNeeds === 'string' ? [apiNeeds] : apiNeeds

      // 设置API默认选项
      apiItem.actionAddr = actionAddr || `${nodePath}${strDelimiter}${presetApiNeeds?.join(',')}`
      apiItem.api = apiItem.url || ''

      store.actionAddrMap[apiItem.actionAddr] = {
        actionDesc,
        api: apiItem.api,
        label: `${nodeLabel}${strDelimiter}${presetApiNeeds
          ?.map((i) => get(limits, `${i}.label`) || '--')
          .join(',')}`,
      }
    })
  })

  return config
}

export function setRoutesConfig(routes: RouteItem[]) {
  publish(message.updateRouteStore)
  store.routesConfig = resolePreset(resolveConfig(cloneDeep(routes)))
}

export function getRouteConfig(refresh?: boolean) {
  if (refresh) {
    // 防止修改原始数据
    return cloneDeep(store.routesConfig)
  }
  return store.routesConfig
}

type ActionAddrOption = {
  ignoreGet: boolean
}
export function getActionAddrMap(option?: ActionAddrOption) {
  const { ignoreGet = true } = option || {}

  if (ignoreGet) {
    return omitBy(store.actionAddrMap, ({ api }) => api.indexOf('GET ') === 0)
  }

  return store.actionAddrMap
}

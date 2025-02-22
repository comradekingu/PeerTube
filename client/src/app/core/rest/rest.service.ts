import { SortMeta } from 'primeng/api'
import { HttpParams } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { ComponentPaginationLight } from './component-pagination.model'
import { RestPagination } from './rest-pagination'

interface QueryStringFilterPrefixes {
  [key: string]: {
    prefix: string
    handler?: (v: string) => string | number
    multiple?: boolean
    isBoolean?: boolean
  }
}

type ParseQueryStringFilters <K extends keyof any> = Partial<Record<K, string | number | boolean | (string | number | boolean)[]>>
type ParseQueryStringFiltersResult <K extends keyof any> = ParseQueryStringFilters<K> & { search?: string }

@Injectable()
export class RestService {

  addRestGetParams (params: HttpParams, pagination?: RestPagination, sort?: SortMeta | string) {
    let newParams = params

    if (pagination !== undefined) {
      newParams = newParams.set('start', pagination.start.toString())
                           .set('count', pagination.count.toString())
    }

    if (sort !== undefined) {
      let sortString = ''

      if (typeof sort === 'string') {
        sortString = sort
      } else {
        const sortPrefix = sort.order === 1 ? '' : '-'
        sortString = sortPrefix + sort.field
      }

      newParams = newParams.set('sort', sortString)
    }

    return newParams
  }

  addArrayParams (params: HttpParams, name: string, values: (string | number)[]) {
    for (const v of values) {
      params = params.append(name, v)
    }

    return params
  }

  addObjectParams (params: HttpParams, object: { [ name: string ]: any }) {
    for (const name of Object.keys(object)) {
      const value = object[name]
      if (value === undefined || value === null) continue

      if (Array.isArray(value)) {
        params = this.addArrayParams(params, name, value)
      } else {
        params = params.append(name, value)
      }
    }

    return params
  }

  componentToRestPagination (componentPagination: ComponentPaginationLight): RestPagination {
    const start: number = (componentPagination.currentPage - 1) * componentPagination.itemsPerPage
    const count: number = componentPagination.itemsPerPage

    return { start, count }
  }

  /*
  * Returns an object containing the filters and the remaining search
  */
  parseQueryStringFilter <T extends QueryStringFilterPrefixes> (q: string, prefixes: T): ParseQueryStringFiltersResult<keyof T> {
    if (!q) return {}

    // Tokenize the strings using spaces that are not in quotes
    const tokens = q.match(/(?:[^\s"]+|"[^"]*")+/g)
                    .filter(token => !!token)

    // Build prefix array
    const prefixeStrings = Object.values(prefixes)
                           .map(p => p.prefix)

    // Search is the querystring minus defined filters
    const searchTokens = tokens.filter(t => {
      return prefixeStrings.every(prefixString => t.startsWith(prefixString) === false)
    })

    const additionalFilters: ParseQueryStringFilters<keyof T> = {}

    for (const prefixKey of Object.keys(prefixes) as (keyof T)[]) {
      const prefixObj = prefixes[prefixKey]
      const prefix = prefixObj.prefix

      const matchedTokens = tokens.filter(t => t.startsWith(prefix))
                                  .map(t => t.slice(prefix.length)) // Keep the value filter
                                  .map(t => t.replace(/^"|"$/g, '')) // Remove ""
                                  .map(t => {
                                    if (prefixObj.handler) return prefixObj.handler(t)

                                    if (prefixObj.isBoolean) {
                                      if (t === 'true') return true
                                      if (t === 'false') return false

                                      return undefined
                                    }

                                    return t
                                  })
                                  .filter(t => t !== null && t !== undefined)

      if (matchedTokens.length === 0) continue

      additionalFilters[prefixKey] = prefixObj.multiple === true
        ? matchedTokens
        : matchedTokens[0]
    }

    return {
      search: searchTokens.join(' ') || undefined,

      ...additionalFilters
    }
  }
}

const _ = require('lodash')
const path = require('path')
const { writeFileSync } = require('fs')

const PATHS_SPEC = require('../specification/paths.json')
const PATHS_SPEC_EXTRAS = require('../specification/extras/paths.json')

const docsPath = path.resolve('docs')

const ROUTES = require('../src/routes/routes.json')

// One of many workarounds for Bitbucket's faulty API Specification
const URL_ALIASES = {
  '/users/{username}/ssh-keys/{key_id}': '/users/{username}/ssh-keys/'
}

const usernameRegex = /\/\{username\}\//

const getAPIDescription = ({ method, url }, apiName, namespaceName) => {
  method = method.toLowerCase()
  url = URL_ALIASES[url] || url

  const spec = _.get(
    PATHS_SPEC,
    url,
    usernameRegex.test(url)
      ? _.get(PATHS_SPEC, url.replace(usernameRegex, '/{workspace}/'))
      : null
  )

  return _.get(
    spec,
    [method, 'description'],
    _.get(spec, [method, 'summary'], '')
  )
}

const getAPIParamDefault = (param, paramName, { method, url }) => {
  method = method.toLowerCase()

  const spec = _.get(
    PATHS_SPEC,
    url,
    usernameRegex.test(url)
      ? _.get(PATHS_SPEC, url.replace(usernameRegex, '/{workspace}/'))
      : null
  )

  let defaultVal =
    (_.find(spec[method].parameters, ['name', paramName]) || {}).default || null

  if (defaultVal === null) {
    defaultVal = (_.find(spec.parameters, ['name', paramName]) || {}).default
  }

  return defaultVal || null
}

const getAPIParamDescription = (param, paramName, { method, url }) => {
  method = method.toLowerCase()

  const spec = _.get(
    PATHS_SPEC,
    url,
    usernameRegex.test(url)
      ? _.get(PATHS_SPEC, url.replace(usernameRegex, '/{workspace}/'))
      : null
  )

  let description = (_.find(spec[method].parameters, ['name', paramName]) || {})
    .description

  if (!description) {
    description = (_.find(spec.parameters, ['name', paramName]) || {})
      .description
  }

  return description || ''
}

const toAPIParamComment = (param, paramName, api) => {
  let paramDescription = getAPIParamDescription(param, paramName, api)
  let paramDefaultVal = getAPIParamDefault(param, paramName, api)
  let paramType = param.type

  let paramLabel = paramName
  if (paramDefaultVal !== null) {
    paramLabel += `="${paramDefaultVal}"`
  }

  let paramRequired = Boolean(param.required)
  if (!paramRequired) {
    paramLabel = `[${paramLabel}]`
  }

  let paramGroup = `Parameters`

  let allowedValues = ''
  if (param.enum) {
    allowedValues = `=${param.enum.join(',')}`
  }

  return ` * @apiParam (${paramGroup}) {${paramType}${allowedValues}} ${paramLabel
    .replace(/\./g, ':')
    .replace(/\[\]/g, '')}  ${paramDescription.split('\n\n')[0]}`
}

const getLinkToOfficialDocs = ({ method, url }, apiName, namespaceName) => {
  url = URL_ALIASES[url] || url

  const specUrl = _.get(PATHS_SPEC, url)
    ? url
    : usernameRegex.test(url)
      ? _.get(PATHS_SPEC, url.replace(usernameRegex, '/{workspace}/'))
        ? url.replace(usernameRegex, '/{workspace}/')
        : null
      : null

  if (!specUrl) {
    throw new Error(`specUrl missing for url: ${url}`)
  }

  return `<a href="https://developer.atlassian.com/bitbucket/api/2/reference/resource${encodeURI(
    specUrl
  )}#${_.lowerCase(method)}">[API Docs]</a>`
}

const toAPIComment = (api, apiName, namespaceName) => {
  if (api.alias) {
    let [namespaceAlias, apiAlias] = api.alias.split('.')
    api = ROUTES[namespaceAlias][apiAlias]
  }

  let method = api.method
  let url = api.url
  let params = api.params

  if (!method) {
    throw new Error(
      `HTTP method missing for ${namespaceName}.${apiName} in routes.json`
    )
  }

  let descriptionWithLinkToOfficialDocs = [
    getAPIDescription(api, apiName, namespaceName).split('\n\n')[0],
    getLinkToOfficialDocs(api, apiName, namespaceName)
  ]
    .filter(Boolean)
    .join(' ')

  const commentLines = [
    `/**`,
    ` * @api {${_.upperCase(method)}} ${url} ${apiName}`,
    ` * @apiName ${namespaceName}.${apiName}`,
    ` * @apiDescription ${descriptionWithLinkToOfficialDocs}`,
    ` * @apiGroup ${namespaceName}`,
    ' *'
  ].concat(
    _.toPairs(params).map(([paramName, param]) =>
      toAPIParamComment(param, paramName, api)
    )
  )

  const paramsString = _.keys(params).join(', ')

  return commentLines
    .concat([
      ` * @apiExample {js} async/await`,
      ` *   let { data, headers } = await bitbucket.${namespaceName}.${apiName}({ ${paramsString} })`,
      ` * @apiExample {js} Promise`,
      ` *   bitbucket.${namespaceName}.${apiName}({ ${paramsString} }).then(({ data, headers }) => {})`,
      ` * @apiExample {js} Callback`,
      ` *   bitbucket.${namespaceName}.${apiName}({ ${paramsString} }, (err, { data, headers }) => {})`,
      ` */`
    ])
    .join('\n')
}

const prepareAPI = (api, apiName, namespaceName) =>
  toAPIComment(api, apiName, namespaceName)

const toSectionComment = namespaceName => `
/**
 * ${namespaceName}
 * @namespace ${namespaceName}
 */
`

const prepareNamespace = (namespace, namespaceName) =>
  [toSectionComment(namespaceName)]
    .concat(
      _.keys(namespace).map(apiName =>
        prepareAPI(namespace[apiName], apiName, namespaceName)
      )
    )
    .join('\n')

const apiDocs = _.keys(ROUTES)
  .map(namespaceName => prepareNamespace(ROUTES[namespaceName], namespaceName))
  .join('\n')
  .trim()

writeFileSync(path.resolve(docsPath, 'apidoc.js'), `${apiDocs}\n`)

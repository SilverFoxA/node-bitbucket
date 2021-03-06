const endpointMethod = require('../endpoint-methods/method.js')
const getParamGroups = require('../endpoint-methods/get-param-groups.js')

const oAuth2Spec = require('./spec.json')

const routes = require('./routes.js')(oAuth2Spec)

class OAuthPlugin {
  constructor(apiClient) {
    this.core = apiClient
    this.scopes = Object.keys(oAuth2Spec.scopes)
  }

  inject() {
    this.core.oauth = {}

    Object.keys(routes).forEach(namespaceName => {
      this.core.oauth[namespaceName] = {}

      Object.keys(routes[namespaceName]).forEach(apiName => {
        let apiOptions = routes[namespaceName][apiName]

        let { method, params: paramsSpecs, url, ...rest } = apiOptions

        let _paramGroups = getParamGroups(paramsSpecs)

        this.core.oauth[namespaceName][apiName] = endpointMethod.bind(
          null,
          this.core,
          { method, url, ...rest, _paramGroups },
          paramsSpecs
        )
      })
    })
  }
}

module.exports = OAuthPlugin

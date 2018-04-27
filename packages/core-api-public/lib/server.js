'use strict';

const Hapi = require('hapi')
const logger = require('@arkecosystem/core-plugin-manager').get('logger')

/**
 * Create a new hapi.js server.
 * @param  {Object} config
 * @return {Hapi.Server}
 */
module.exports = async (config) => {
  if (!config.enabled) {
    return logger.info('Oh snap! Public API not enabled')
  }

  const baseConfig = {
    port: config.port,
    routes: {
      cors: true,
      validate: {
        failAction: async (request, h, err) => { throw err }
      }
    }
  }

  if (config.cache.enabled) {
    const cacheOptions = config.cache.options
    cacheOptions.engine = require(cacheOptions.engine)
    baseConfig.cache = [cacheOptions]
    baseConfig.routes.cache = { expiresIn: cacheOptions.expiresIn }
  }

  const server = new Hapi.Server(baseConfig)

  await server.register([require('vision'), require('inert'), require('lout')])

  await server.register({
    plugin: require('hapi-api-version'),
    options: {
      validVersions: config.versions.valid,
      defaultVersion: config.versions.default,
      basePath: '/api/',
      vendorName: 'ark-core-public-api'
    }
  })

  await server.register({ plugin: require('./plugins/caster') })

  await server.register({ plugin: require('./plugins/validation') })

  await server.register({
    plugin: require('hapi-rate-limit'),
    options: {
      enabled: config.rateLimit.enabled,
      pathLimit: false,
      userLimit: config.rateLimit.limit,
      userCache: {
        expiresIn: config.rateLimit.expires
      }
    }
  })

  await server.register({
    plugin: require('hapi-pagination'),
    options: {
      meta: {
        baseUri: ''
      },
      query: {
        limit: {
          default: config.pagination.limit
        }
      },
      results: {
        name: 'data'
      },
      routes: {
        include: config.pagination.include,
        exclude: ['*']
      }
    }
  })

  await server.register({
    plugin: require('./versions/1'),
    routes: { prefix: '/api/v1' }
  })

  await server.register({
    plugin: require('./versions/2'),
    routes: { prefix: '/api/v2' },
    options: config
  })

  try {
    await server.start()

    logger.info(`Oh hapi day! Public API is listening on ${server.info.uri}`)

    return server
  } catch (error) {
    logger.error(error.stack)

    process.exit(1)
  }
}

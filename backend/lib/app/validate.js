import * as schemaTests from '../../../csaf-validator-lib/schemaTests.js'
import * as mandatoryTests from '../../../csaf-validator-lib/mandatoryTests.js'
import * as optionalTests from '../../../csaf-validator-lib/optionalTests.js'
import * as informativeTests from '../../../csaf-validator-lib/informativeTests.js'
import * as basic from '../../../csaf-validator-lib/basic.js'
import * as extended from '../../../csaf-validator-lib/extended.js'
import * as full from '../../../csaf-validator-lib/full.js'
import validate from '../../../csaf-validator-lib/validate.js'

/** @type {Record<string, Parameters<typeof validate>[0][number] | undefined>} */
const tests = Object.fromEntries(
  /** @type {Array<[string, any]>} */ (Object.entries(schemaTests))
    .concat(Object.entries(mandatoryTests))
    .concat(Object.entries(optionalTests))
    .concat(Object.entries(informativeTests))
)

/** @type {Record<string, Parameters<typeof validate>[0] | undefined>} */
const presets = {
  schema: Object.values(schemaTests),
  mandatory: Object.values(mandatoryTests),
  optional: Object.values(optionalTests),
  informative: Object.values(informativeTests),
  basic: Object.values(basic),
  extended: Object.values(extended),
  full: Object.values(full),
}

/** @typedef {Parameters<typeof validate>[0][number]} DocumentTest */

const swaggerInfo = {
  description:
    'This endpoint is intended to validate a document against the specified tests.',
  summary: 'Validate document.',
}

/** @type {import('ajv').JSONSchemaType<import('./validate/types.js').RequestBody>} */
const requestBodySchema = {
  type: 'object',
  required: ['document', 'tests'],
  properties: {
    tests: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            required: ['name', 'type'],
            properties: {
              name: { type: 'string', enum: Object.keys(tests) },
              type: { type: 'string', enum: ['test'] },
            },
          },
          {
            type: 'object',
            required: ['name', 'type'],
            properties: {
              name: { type: 'string', enum: Object.keys(presets) },
              type: { type: 'string', enum: ['preset'] },
            },
          },
        ],
      },
    },
    document: {
      type: 'object',
      additionalProperties: true,
      properties: {},
    },
  },
}

/** @type {import('ajv').JSONSchemaType<import('./validate/types.js').ResponseBody>} */
const responseSchema = {
  type: 'object',
  required: ['isValid', 'tests'],
  properties: {
    isValid: { type: 'boolean' },
    tests: {
      type: 'array',
      items: {
        type: 'object',
        required: ['errors', 'infos', 'isValid', 'name', 'warnings'],
        properties: {
          errors: {
            type: 'array',
            items: {
              type: 'object',
              required: ['instancePath'],
              properties: {
                instancePath: { type: 'string' },
                message: { type: 'string', nullable: true },
              },
            },
          },
          infos: {
            type: 'array',
            items: {
              type: 'object',
              required: ['instancePath', 'message'],
              properties: {
                instancePath: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
          warnings: {
            type: 'array',
            items: {
              type: 'object',
              required: ['instancePath', 'message'],
              properties: {
                instancePath: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
          isValid: { type: 'boolean' },
          name: { type: 'string' },
        },
      },
    },
  },
}

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function (fastify) {
  fastify.post(
    '/api/v1/validate',
    {
      schema: {
        ...swaggerInfo,
        body: requestBodySchema,
        response: {
          200: responseSchema,
        },
      },
    },

    /**
     * @returns {Promise<import('./validate/types.js').ResponseBody>}
     */
    async (request) => {
      const requestBody =
        /** @type {import('./validate/types.js').RequestBody} */ (request.body)

      const results = await validate(
        requestBody.tests
          .flatMap((t) =>
            t.type === 'preset'
              ? presets[t.name] ?? []
              : [tests[t.name]].filter(
                  /** @returns {t is DocumentTest} */
                  (t) => Boolean(t)
                )
          )

          // Filter duplicated tests
          .filter(
            (test, i, array) =>
              array.findIndex((a) => a.name === test.name) === i
          ),
        requestBody.document
      )

      return results
    }
  )
}

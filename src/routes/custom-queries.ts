import {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify';

import {
  getResponseStructureSchema,
  mapDataTypeToJsonSchema,
} from '@/routes/schema-helpers';

import {ApisConfig, DataType} from '@/schema/config';

export function registerCustomQueryRoutes(
  app: FastifyInstance,
  apis?: ApisConfig,
): void {
  if (!apis || !apis.customQueries) return;

  for (const cq of apis.customQueries) {
    // in magic variables we support 3 types of variables
    // body, path, and query
    const paramsProperties: Record<string, object> = {};
    const queryProperties: Record<string, object> = {};
    const bodyProperties: Record<string, object> = {};

    // body parameters are always in between @@
    // path parameters are always in between $$
    // query parameters are always in between &&
    // each magic variable also contain the type of the variable seperated using :
    // example: @@name:string@@
    const delims = ['@@', '$$', '&&'];
    const foundDelims: {pos: number; type: string}[] = [];

    // here we are detecting all the magic varaibles and their position
    delims.forEach(d => {
      let pos = cq.query.indexOf(d);
      while (pos !== -1) {
        foundDelims.push({pos, type: d});
        pos = cq.query.indexOf(d, pos + 2);
      }
    });

    // ordering it by the position
    foundDelims.sort((a, b) => a.pos - b.pos);

    for (let i = 0; i < foundDelims.length; i += 2) {
      const start = foundDelims[i];
      const end = foundDelims[i + 1];

      if (!end || start.type !== end.type) continue;

      // extracting the variable name and type
      const varString = cq.query.substring(start.pos + 2, end.pos);
      const parts = varString.split(':');

      // skipping parts validation as it is not needed, config validator automatically does it
      const varName = parts[0];
      const varTypeStr = parts[1];

      // building the schema based on the type of the variable and the name of the variable
      // also based on the delimiter type we are adding the schema to the params, query or body
      // if the delimiter is @@ then it is a body parameter
      // if the delimiter is $$ then it is a path parameter
      // if the delimiter is && then it is a query parameter
      const jsonSchema = {
        ...mapDataTypeToJsonSchema(varTypeStr as DataType),
        description: `Custom ${start.type === '@@' ? 'body' : start.type === '&&' ? 'query' : 'path'} parameter`,
      };

      // adding the schema to the params, query or body based on the delimiter type
      if (start.type === '$$') {
        paramsProperties[varName] = jsonSchema;
      } else if (start.type === '&&') {
        queryProperties[varName] = jsonSchema;
      } else if (start.type === '@@') {
        bodyProperties[varName] = jsonSchema;
      }
    }

    // building the schema for the custom query
    const schema: Record<string, unknown> = {
      summary: `Custom Query API: ${cq.path}`,
      description: `Custom endpoint mapped to ${cq.path}`,
      tags: ['Custom Queries'],
    };

    let routePath = `/custom-queries${cq.path.replace(/\/$/, '')}`;
    const paramsKeys = Object.keys(paramsProperties);

    // magic variables are optional, so if we have any magic variable we are adding it to the swagger schema
    if (paramsKeys.length > 0) {
      for (const key of paramsKeys) {
        routePath += `/:${key}`;
      }
      schema.params = {
        type: 'object',
        properties: paramsProperties,
        additionalProperties: false, // additional properties are not allowed
      };
    }
    if (Object.keys(queryProperties).length > 0) {
      schema.querystring = {
        type: 'object',
        properties: queryProperties,
        additionalProperties: false, // additional properties are not allowed
      };
    }
    if (Object.keys(bodyProperties).length > 0 && cq.method !== 'GET') {
      schema.body = {
        type: 'object',
        properties: bodyProperties,
        additionalProperties: false, // additional properties are not allowed
      };
    }

    schema.response = getResponseStructureSchema([200], {
      type: 'object',
      properties: {
        data: {type: 'string'},
      },
    });

    app.route({
      method: cq.method,
      url: routePath,
      schema,
      handler: async (request: FastifyRequest, reply: FastifyReply) => {
        return reply.status(200).send(
          app.buildResponse(200, 'Success', {
            data: 'Hello world',
          }),
        );
      },
    });
  }
}

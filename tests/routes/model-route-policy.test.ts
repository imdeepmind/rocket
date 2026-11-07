import {FastifyInstance} from 'fastify';
import {describe, expect, test, vi} from 'vitest';

import {resolveConfig} from '@/lib/config/resolve';

import {registerSearchRoutes} from '@/routes/models/search';

import {ModelConfig} from '@/interfaces/config';

const searchableModels: Record<string, ModelConfig> = {
  posts: {
    fields: {
      id: {type: 'integer', primaryKey: true},
      title: {type: 'string', apis: ['search']},
    },
  },
};

function fakeApp(): FastifyInstance {
  return {
    get: vi.fn(),
    callWebhook: vi.fn(),
  } as unknown as FastifyInstance;
}

function routeSchemas(app: FastifyInstance): Array<Record<string, unknown>> {
  return (
    app.get as unknown as {
      mock: {calls: Array<[string, {schema: Record<string, unknown>}]>};
    }
  ).mock.calls.map(call => call[1].schema);
}

describe('model route policy regression', () => {
  test('default routes use configured tags instead of derived tags', () => {
    const app = fakeApp();
    const config = resolveConfig(
      {
        application: {name: 'Tags Test'},
        data: {models: searchableModels},
        apis: {
          'model.v1.posts.title.search': {tags: ['Custom Tag']},
        },
      },
      {mode: 'dev'},
    );

    registerSearchRoutes(app, config);

    expect(routeSchemas(app)).toHaveLength(1);
    expect(routeSchemas(app)[0].tags).toEqual(['Custom Tag']);
  });

  test('default routes fall back to derived tags when not configured', () => {
    const app = fakeApp();
    const config = resolveConfig(
      {application: {name: 'Tags Test'}, data: {models: searchableModels}},
      {mode: 'dev'},
    );

    registerSearchRoutes(app, config);

    expect(routeSchemas(app)[0].tags).toEqual(['Posts', 'Read']);
  });

  test('variant routes inherit tags from the base identifier', () => {
    const app = fakeApp();
    const config = resolveConfig(
      {
        application: {name: 'Tags Test'},
        data: {models: searchableModels},
        apis: {'model.v1.posts.title.search': {tags: ['Base Tag']}},
        apiVariants: {
          'model.v1.posts.title.search': {variants: ['admin']},
        },
      },
      {mode: 'dev'},
    );

    registerSearchRoutes(app, config);

    expect(routeSchemas(app).map(schema => schema.tags)).toEqual([
      ['Base Tag'],
      ['Base Tag'],
    ]);
  });
});

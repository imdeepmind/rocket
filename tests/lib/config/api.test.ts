import {expect, test} from 'vitest';

import {getEffectiveAggregations, getEffectiveQueries} from '@/lib/config/api';

import {AppConfig} from '@/interfaces/config';

// test cases for getEffectiveQueries
test('getEffectiveQueries should return undefined when no api config', () => {
  const config: AppConfig = {
    application: {name: 'test', logLevel: 'info'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {
      database: {engine: 'postgres', connection: {url: 'postgresql://'}},
    },
    data: {models: {}},
  };
  expect(
    getEffectiveQueries(config, 'model.v1.users.unknown.getAll'),
  ).toBeUndefined();
});

test('getEffectiveQueries should return supportedQueries from api config', () => {
  const config: AppConfig = {
    application: {name: 'test', logLevel: 'info'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {
      database: {engine: 'postgres', connection: {url: 'postgresql://'}},
    },
    data: {models: {}},
    apis: {
      'model.v1.users.unknown.getAll': {
        supportedQueries: ['lt', 'gt'],
      },
    },
  };
  expect(getEffectiveQueries(config, 'model.v1.users.unknown.getAll')).toEqual([
    'lt',
    'gt',
  ]);
});

test('getEffectiveQueries should return undefined for unmatched api identifier', () => {
  const config: AppConfig = {
    application: {name: 'test', logLevel: 'info'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {
      database: {engine: 'postgres', connection: {url: 'postgresql://'}},
    },
    data: {models: {}},
    apis: {
      'model.v1.users.unknown.getAll': {
        supportedQueries: ['lt', 'gt'],
      },
    },
  };
  expect(
    getEffectiveQueries(config, 'model.v1.products.unknown.getAll'),
  ).toBeUndefined();
});

// test cases for getEffectiveAggregations
test('getEffectiveAggregations should return undefined when no api config', () => {
  const config: AppConfig = {
    application: {name: 'test', logLevel: 'info'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {
      database: {engine: 'postgres', connection: {url: 'postgresql://'}},
    },
    data: {models: {}},
  };
  expect(
    getEffectiveAggregations(
      config,
      'aggregate.v1.sales.amount.getAggregation',
    ),
  ).toBeUndefined();
});

test('getEffectiveAggregations should return supportedAggregations from api config', () => {
  const config: AppConfig = {
    application: {name: 'test', logLevel: 'info'},
    docs: {
      openapi: {
        enabled: false,
        path: '/docs',
        info: {title: 'Test', version: '1.0.0'},
      },
    },
    infrastructure: {
      database: {engine: 'postgres', connection: {url: 'postgresql://'}},
    },
    data: {models: {}},
    apis: {
      'aggregate.v1.sales.amount.getAggregation': {
        supportedAggregations: ['count', 'sum'],
      },
    },
  };
  expect(
    getEffectiveAggregations(
      config,
      'aggregate.v1.sales.amount.getAggregation',
    ),
  ).toEqual(['count', 'sum']);
});

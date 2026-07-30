import {describe, expect, it, vi} from 'vitest';

import {
  buildSqlEndpoint,
  handleSql,
} from '@/routes/custom-endpoints/handlers/sql';

describe('buildSqlEndpoint', () => {
  it('should return empty result when no delimiters', () => {
    const result = buildSqlEndpoint('SELECT * FROM users;', 'GET');
    expect(result.params).toBeUndefined();
    expect(result.querystring).toBeUndefined();
    expect(result.body).toBeUndefined();
    expect(result.routePath).toBe('');
  });

  it('should detect path params ($$)', () => {
    const result = buildSqlEndpoint(
      'SELECT * FROM users WHERE id = $$id:integer$$;',
      'GET',
    );
    expect(result.params).toBeDefined();
    expect(result.params).toHaveProperty('properties.id');
    expect(result.routePath).toBe('/:id');
  });

  it('should detect body params (@@)', () => {
    const result = buildSqlEndpoint(
      'UPDATE users SET name = @@name:string@@ WHERE id = @@id:integer@@;',
      'POST',
    );
    expect(result.body).toBeDefined();
    expect(result.body).toHaveProperty('properties.name');
    expect(result.body).toHaveProperty('properties.id');
    expect(result.routePath).toBe('');
  });

  it('should detect query params (&&)', () => {
    const result = buildSqlEndpoint(
      'SELECT * FROM users WHERE status = &&status:string&& AND age >= &&minAge:integer&&;',
      'GET',
    );
    expect(result.querystring).toBeDefined();
    expect(result.querystring).toHaveProperty('properties.status');
    expect(result.querystring).toHaveProperty('properties.minAge');
    expect(result.routePath).toBe('');
  });

  it('should not add body schema for GET method', () => {
    const result = buildSqlEndpoint(
      'SELECT * FROM users WHERE id = @@id:integer@@;',
      'GET',
    );
    expect(result.body).toBeUndefined();
  });

  it('should handle mismatched delimiters gracefully', () => {
    const result = buildSqlEndpoint(
      'SELECT * FROM users WHERE id = $$id:integer@@;',
      'GET',
    );
    expect(result.params).toBeUndefined();
    expect(result.querystring).toBeUndefined();
    expect(result.body).toBeUndefined();
    expect(result.routePath).toBe('');
  });

  it('should skip header magic variables (^^) without building schema', () => {
    const result = buildSqlEndpoint(
      'SELECT * FROM users WHERE api_key = ^^x-api-key:string^^ AND id = $$id:integer$$;',
      'GET',
    );
    expect(result.params).toBeDefined();
    expect(result.params).toHaveProperty('properties.id');
    expect(result.querystring).toBeUndefined();
    expect(result.body).toBeUndefined();
    expect(result.routePath).toBe('/:id');
  });
});

describe('handleSql', () => {
  function mockApp() {
    return {
      buildResponse: (code: number, message: string, data: unknown) => ({
        code,
        message,
        data,
      }),
      db: {
        query: vi.fn().mockResolvedValue({rows: [], changes: 0}),
        close: vi.fn(),
      },
    };
  }

  function mockReply() {
    return {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('should execute a simple query', async () => {
    const app = mockApp();
    const reply = mockReply();

    await handleSql(
      app as never,
      {params: {}, query: {}, body: {}} as never,
      reply as never,
      'SELECT 1;',
    );

    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      code: 200,
      message: 'Success',
      data: {data: [], res: {rows: [], changes: 0}},
    });
  });

  it('should extract path params with $$delimiter', async () => {
    const app = mockApp();
    app.db.query = vi.fn().mockResolvedValue({rows: [{id: 42}], changes: 0});
    const reply = mockReply();

    await handleSql(
      app as never,
      {params: {id: 42}, query: {}, body: {}} as never,
      reply as never,
      'SELECT * FROM users WHERE id = $$id:integer$$;',
    );

    expect(app.db.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE id = $1;',
      [42],
    );
    expect(reply.status).toHaveBeenCalledWith(200);
    expect(reply.send).toHaveBeenCalledWith({
      code: 200,
      message: 'Success',
      data: {data: [{id: 42}], res: {rows: [{id: 42}], changes: 0}},
    });
  });

  it('should extract body params with @@delimiter', async () => {
    const app = mockApp();
    app.db.query = vi.fn().mockResolvedValue({rows: [], changes: 1});
    const reply = mockReply();

    await handleSql(
      app as never,
      {params: {}, query: {}, body: {name: 'Jane', id: 1}} as never,
      reply as never,
      'UPDATE users SET name = @@name:string@@ WHERE id = @@id:integer@@;',
    );

    expect(app.db.query).toHaveBeenCalledWith(
      'UPDATE users SET name = $1 WHERE id = $2;',
      ['Jane', 1],
    );
    expect(reply.status).toHaveBeenCalledWith(200);
  });

  it('should extract query params with &&delimiter', async () => {
    const app = mockApp();
    app.db.query = vi
      .fn()
      .mockResolvedValue({rows: [{id: 1, status: 'active'}], changes: 0});
    const reply = mockReply();

    await handleSql(
      app as never,
      {params: {}, query: {status: 'active'}, body: {}} as never,
      reply as never,
      'SELECT * FROM users WHERE status = &&status:string&&;',
    );

    expect(app.db.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE status = $1;',
      ['active'],
    );
    expect(reply.status).toHaveBeenCalledWith(200);
  });

  it('should throw error when path param is missing', async () => {
    const app = mockApp();
    const reply = mockReply();

    await expect(
      handleSql(
        app as never,
        {params: {}, query: {}, body: {}} as never,
        reply as never,
        'SELECT * FROM users WHERE id = $$id:integer$$;',
      ),
    ).rejects.toThrow('Missing path param: "id"');
  });

  it('should throw error when body param is missing', async () => {
    const app = mockApp();
    const reply = mockReply();

    await expect(
      handleSql(
        app as never,
        {params: {}, query: {}, body: {}} as never,
        reply as never,
        'UPDATE users SET name = @@name:string@@;',
      ),
    ).rejects.toThrow('Missing body param: "name"');
  });

  it('should throw error when query param is missing', async () => {
    const app = mockApp();
    const reply = mockReply();

    await expect(
      handleSql(
        app as never,
        {params: {}, query: {}, body: {}} as never,
        reply as never,
        'SELECT * FROM users WHERE status = &&status:string&&;',
      ),
    ).rejects.toThrow('Missing query param: "status"');
  });

  it('should extract header params with ^^delimiter', async () => {
    const app = mockApp();
    app.db.query = vi.fn().mockResolvedValue({rows: [{id: 1}], changes: 0});
    const reply = mockReply();

    await handleSql(
      app as never,
      {
        params: {},
        query: {},
        body: {},
        headers: {'x-api-key': 'secret-123'},
      } as never,
      reply as never,
      'SELECT * FROM users WHERE api_key = ^^x-api-key:string^^;',
    );

    expect(app.db.query).toHaveBeenCalledWith(
      'SELECT * FROM users WHERE api_key = $1;',
      ['secret-123'],
    );
    expect(reply.status).toHaveBeenCalledWith(200);
  });

  it('should throw error when header param is missing', async () => {
    const app = mockApp();
    const reply = mockReply();

    await expect(
      handleSql(
        app as never,
        {params: {}, query: {}, body: {}, headers: {}} as never,
        reply as never,
        'SELECT * FROM users WHERE api_key = ^^x-api-key:string^^;',
      ),
    ).rejects.toThrow('Missing header param: "x-api-key"');
  });

  it('should support all data types', async () => {
    const app = mockApp();
    app.db.query = vi.fn().mockResolvedValue({rows: [], changes: 0});
    const reply = mockReply();
    const jsonData = {foo: 'bar'};

    await handleSql(
      app as never,
      {
        params: {
          id: 42,
          b: true,
          s: 'hello',
          t: 'long text',
          dt: '2023-01-01T00:00:00Z',
          dec: 12.34,
          d: '2023-01-01',
          j: jsonData,
          e: 'active',
        },
        query: {},
        body: {},
      } as never,
      reply as never,
      'INSERT INTO test VALUES ($$id:integer$$, $$b:boolean$$, $$s:string$$, $$t:text$$, $$dt:datetime$$, $$dec:decimal$$, $$d:date$$, $$j:json$$, $$e:enum$$);',
    );

    const values = app.db.query.mock.calls[0][1];
    expect(values[0]).toBe(42);
    expect(values[1]).toBe(true);
    expect(values[2]).toBe('hello');
    expect(values[3]).toBe('long text');
    expect(values[4]).toBe('2023-01-01T00:00:00Z');
    expect(values[5]).toBe(12.34);
    expect(values[6]).toBe('2023-01-01');
    expect(values[7]).toBe(jsonData);
    expect(values[8]).toBe('active');
    expect(reply.status).toHaveBeenCalledWith(200);
  });

  it('should cast string "true"/"false" to boolean for path params', async () => {
    const app = mockApp();
    const reply = mockReply();

    await handleSql(
      app as never,
      {params: {flag: 'true'}, query: {}, body: {}} as never,
      reply as never,
      'SELECT * FROM users WHERE active = $$flag:boolean$$;',
    );

    let callArgs = app.db.query.mock.calls[0][1];
    expect(callArgs[0]).toBe(true);
    expect(reply.status).toHaveBeenCalledWith(200);

    const reply2 = mockReply();
    await handleSql(
      app as never,
      {params: {flag: 'false'}, query: {}, body: {}} as never,
      reply2 as never,
      'SELECT * FROM users WHERE active = $$flag:boolean$$;',
    );

    callArgs = app.db.query.mock.calls[1][1];
    expect(callArgs[0]).toBe(false);
    expect(reply2.status).toHaveBeenCalledWith(200);
  });

  it('should handle unknown type by casting to string', async () => {
    const app = mockApp();
    app.db.query = vi.fn().mockResolvedValue({rows: [], changes: 0});
    const reply = mockReply();

    await handleSql(
      app as never,
      {params: {id: 42}, query: {}, body: {}} as never,
      reply as never,
      'SELECT * FROM users WHERE id = $$id:unknown$$;',
    );

    const values = app.db.query.mock.calls[0][1];
    expect(values[0]).toBe('42');
    expect(reply.status).toHaveBeenCalledWith(200);
  });
});

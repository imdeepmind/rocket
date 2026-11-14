/* eslint-disable @typescript-eslint/no-explicit-any */

export async function generateReport(request: any, app: any) {
  const {projectId, teamId} = request.params;
  const {format, includeMetrics} = request.query;
  const {title, threshold, filterConfig, tags} = request.body;
  const clientId = request.headers['x-client-id'];
  const correlationId = request.headers['x-correlation-id'];

  const dbRes = await app.db.query(
    'SELECT count(*) as count FROM tasks WHERE project_id = ?',
    [projectId],
  );

  return {
    projectId: Number(projectId),
    teamId: Number(teamId),
    format,
    includeMetrics: includeMetrics === true || includeMetrics === 'true',
    title,
    threshold: Number(threshold),
    filterConfig,
    tags,
    clientId,
    correlationId,
    dbTaskCount: Number(dbRes.rows[0]?.count ?? 0),
    appName: app.appConfig.application.name,
  };
}

export function syncCompute(request: any) {
  const val = Number(request.params.value);
  return {
    doubled: val * 2,
    squared: val * val,
    isSync: true,
  };
}

export async function cacheDbHandler(_request: any, app: any) {
  const cached = await app.cache.get('e2e_stat');
  if (cached !== undefined && cached !== null) {
    return {fromCache: true, value: cached};
  }
  const dbRes = await app.db.query('SELECT count(*) as count FROM tasks');
  const count = Number(dbRes.rows[0]?.count ?? 0);
  await app.cache.set('e2e_stat', count, 60);
  return {fromCache: false, value: count};
}

export async function errorHandler(request: any) {
  const code = Number(request.body.code);
  if (code === 404) {
    const err: any = new Error('Custom entity not found');
    err.statusCode = 404;
    throw err;
  }
  if (code === 409) {
    const err: any = new Error('Custom conflict detected');
    err.statusCode = 409;
    throw err;
  }
  if (code === 422) {
    const err: any = new Error('Semantic validation error');
    err.statusCode = 422;
    throw err;
  }
  throw new Error('Unhandled internal error in function');
}

export async function adminAudit(request: any) {
  return {
    auditPassed: true,
    user: request.user,
  };
}

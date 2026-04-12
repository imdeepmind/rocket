import chalk from 'chalk';

import {AppConfig} from '@/schema/config';

export interface RouteInfo {
  method: string;
  url: string;
}

const ROCKET_ASCII = `
                                                                     
                                                                     
                                                       :!FxvcccF     
                                                ;vLQQQQQQQQQQQQQc    
                                           ;rLQQQQQQQQQQQQLCLQQQc    
                                        fJQQQQQQQQJuTi      UQQQn    
                                     TCQQQQQQQn:           .QQQQf    
                                   ,YQQQQQQY;               ;QQQQ,    
                                 ICQQQQQz;                  rQQQX     
                               iCQQQQLT                    ,LQQQf     
                            .CQQQQQi                      rQQQC      
                           fQQQQL!    ,YQQQQQQCl         iQQQQ!      
                ixYQQQQQQQQQQQQn     fQQQQQQQQQQz        UQQQz       
             xLQQQQQQQQQQQQQQQ;     ;QQQQj  ;LQQQF      YQQQL.       
          :UQQQQQQCzf: iQQQQU       !QQQQ:   UQQQv     YQQQL         
         zQQQQQv;     lQQQQv         UQQQQvnLQQQL:    XQQQLi         
       ;LQQQQt       lQQQQx          .YQQQQQQQQLi   .JQQQL;          
      lQQQQz        ,QQQQn              jCLLCv,    !QQQQL,           
     IQQQQx         XQQQJ                        .YQQQQz             
     YQQQc         jQQQL,                       rQQQQLl              
    !QQQQ;         CQQQF                      FLQQQQu                
    nQQQLcccccccccYQQQJ                    .nQQQQQU,                 
    vQQQQQQQQQQQQQQQQQx                  tJQQQQQX,                   
    .vQQQQQQQQQQQQQQQQQu              fUQQQQQQQ!                     
                   nQQQQQt       .!JQQQQQQQQQQQF                     
           .nQL!    ,YQQQQLftxUQQQQQQQQQzI CQQQf                     
          nQQQQC      iCQQQQQQQQQQQQYT,   ;QQQQl                     
         CQQQQu         .JQQQQQX!.        rQQQJ                      
       .CQQQJ            .QQQQ;          !QQQQ!                      
       UQQQY       lUCj  .QQQQ;         !LQQQu                       
      iQQQQ:     ,JQQQQ: .QQQQ;        zQQQQv                        
      TQQQX   .rQQQQQQt  .QQQQ;      xQQQQQf                         
      fQQQQQQQQQQQQQj    .QQQQ;  ;rLQQQQQc.                          
      iQQQQQQQQQLn:      .QQQQQQQQQQQQQn.                            
        .itl:.           .QQQQQQQQQQv.                               
                          ;cXzuFi                                    
                                                                     
                                                   
`;

function getMethodColor(method: string) {
  const colors: Record<string, chalk.Chalk> = {
    GET: chalk.green,
    POST: chalk.yellow,
    PUT: chalk.blue,
    PATCH: chalk.blueBright,
    DELETE: chalk.red,
    HEAD: chalk.magenta,
    OPTIONS: chalk.cyan,
  };

  // Handle multi-methods like GET/HEAD
  if (method.includes('/')) {
    return method
      .split('/')
      .map(m => {
        const color = colors[m.toUpperCase()] || chalk.white;
        return color(m);
      })
      .join(chalk.gray('/'));
  }

  return (colors[method.toUpperCase()] || chalk.white)(method);
}

const MODEL_COLORS = [
  chalk.yellow,
  chalk.magenta,
  chalk.cyan,
  chalk.blueBright,
  chalk.greenBright,
  chalk.redBright,
];

export function showWelcomeScreen(
  config: AppConfig,
  port: number,
  routes: RouteInfo[],
) {
  const coloredRocket = ROCKET_ASCII.split('\n')
    .map(line => {
      return line
        .replace(/[QLUCJFTYXIF]+/g, m => chalk.blueBright(m))
        .replace(/[nzvxticulr]+/g, m => chalk.cyan(m))
        .replace(/[;:,!]+/g, m => chalk.gray(m));
    })
    .join('\n');

  console.log(coloredRocket);

  console.log('\n');
  console.log('  ' + chalk.bold.bgWhite.black(' ROCKET API FRAMEWORK '));
  console.log('  ' + chalk.dim('🚀 Lift off your development with ease'));
  console.log('\n');

  const swaggerUrl = config.swagger.enabled
    ? `http://0.0.0.0:${port}${config.swagger.basePath}`
    : 'Disabled';

  console.log('  ' + chalk.cyan('System Status:'));
  console.log('  ' + chalk.gray('─────────────────────────────────────────'));
  console.log(
    '  ' + chalk.white('API Host:    ') + chalk.green(`http://0.0.0.0:${port}`),
  );
  console.log('  ' + chalk.white('Swagger UI:  ') + chalk.green(swaggerUrl));
  console.log(
    '  ' +
      chalk.white('Database:    ') +
      chalk.magenta(config.database.engine.toUpperCase()),
  );
  console.log(
    '  ' + chalk.white('Models:      ') + chalk.magenta(config.models.length),
  );
  console.log('  ' + chalk.gray('─────────────────────────────────────────'));

  // Log models
  console.log('\n  ' + chalk.cyan('Models:'));
  config.models.forEach((model, index) => {
    const color = MODEL_COLORS[index % MODEL_COLORS.length];
    console.log(
      '  ' +
        chalk.white('• ') +
        color(model.name.padEnd(15)) +
        chalk.gray(` (${model.fields.length} fields)`),
    );
  });

  // Log routes
  console.log('\n  ' + chalk.cyan('Routes:'));
  // Filter routes
  const filteredRoutes = routes.filter(route => {
    const isHead = route.method.toUpperCase().split('/').includes('HEAD');
    const isStatic = route.url.includes('/static');
    return !isHead && !isStatic;
  });

  const sortedRoutes = [...filteredRoutes].sort((a, b) =>
    a.url.localeCompare(b.url),
  );

  // Determine max method length for padding (ignoring color codes)
  const maxMethodLength = Math.max(
    ...filteredRoutes.map(r => r.method.length),
    7,
  );

  sortedRoutes.forEach(route => {
    const coloredMethod = getMethodColor(route.method);
    // Calculate padding manually to account for colors in getMethodColor result
    const padding = ' '.repeat(
      Math.max(0, maxMethodLength - route.method.length),
    );

    console.log('  ' + coloredMethod + padding + chalk.white(`  ${route.url}`));
  });

  console.log('\n  ' + chalk.gray('─────────────────────────────────────────'));
  console.log('  ' + chalk.dim('Press Ctrl+C to stop the server'));
  console.log('\n');
}

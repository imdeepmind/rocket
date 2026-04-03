import chalk from 'chalk';
import { AppConfig } from '../schema/config';

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

export function showWelcomeScreen(config: AppConfig, port: number, routes: RouteInfo[]) {
  // Clear console for a fresh look
  process.stdout.write('\x1Bc');

  // Colorize the rocket (using some gradients or alternating colors based on characters)
  const coloredRocket = ROCKET_ASCII.split('\n')
    .map((line) => {
      return line
        .replace(/[QLUCJFTYXIF]+/g, (m) => chalk.blueBright(m))
        .replace(/[nzvxticulr]+/g, (m) => chalk.cyan(m))
        .replace(/[;:,!]+/g, (m) => chalk.gray(m));
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
  console.log('  ' + chalk.white('API Host:    ') + chalk.green(`http://0.0.0.0:${port}`));
  console.log('  ' + chalk.white('Swagger UI:  ') + chalk.green(swaggerUrl));
  console.log(
    '  ' + chalk.white('Database:    ') + chalk.magenta(config.database.engine.toUpperCase())
  );
  console.log('  ' + chalk.white('Models:      ') + chalk.magenta(config.models.length));
  console.log('  ' + chalk.gray('─────────────────────────────────────────'));

  // Log models detail
  console.log('\n  ' + chalk.cyan('Models:'));
  config.models.forEach((model) => {
    console.log(
      '  ' +
        chalk.white('• ') +
        chalk.yellow(model.name.padEnd(15)) +
        chalk.gray(` (${model.fields.length} fields)`)
    );
  });

  // Log all routes
  console.log('\n  ' + chalk.cyan('Routes:'));
  const sortedRoutes = [...routes].sort((a, b) => a.url.localeCompare(b.url));
  sortedRoutes.forEach((route) => {
    const methodColor =
      {
        GET: chalk.green,
        POST: chalk.yellow,
        PUT: chalk.blue,
        PATCH: chalk.blue,
        DELETE: chalk.red,
      }[route.method] || chalk.white;

    console.log('  ' + methodColor(route.method.padEnd(7)) + chalk.white(` ${route.url}`));
  });

  console.log('\n  ' + chalk.gray('─────────────────────────────────────────'));
  console.log('  ' + chalk.dim('Press Ctrl+C to stop the server'));
  console.log('\n');
}

export type Mode = 'dev' | 'prod';

export interface CLIOptions {
  config: string;
  port: number;
  mode: Mode;
}

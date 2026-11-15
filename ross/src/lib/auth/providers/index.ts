import {ResolvedSsoProvider} from '@/interfaces/config';

import {SsoAdapter} from '../adapter';
import * as oauth2 from './oauth2';
import * as oidc from './oidc';
import * as saml from './saml';

export function getAdapter(provider: ResolvedSsoProvider): SsoAdapter {
  switch (provider.protocol) {
    case 'oidc':
      return oidc;
    case 'oauth2':
      return oauth2;
    case 'saml':
      return saml;
    default:
      throw new Error(
        `Unsupported SSO protocol: ${String((provider as {protocol: string}).protocol)}`,
      );
  }
}

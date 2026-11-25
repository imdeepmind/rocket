import * as oauth2 from './oauth2.js';
import * as oidc from './oidc.js';
import * as saml from './saml.js';
export function getAdapter(provider) {
    switch (provider.protocol) {
        case 'oidc':
            return oidc;
        case 'oauth2':
            return oauth2;
        case 'saml':
            return saml;
        default:
            throw new Error(`Unsupported SSO protocol: ${String(provider.protocol)}`);
    }
}
//# sourceMappingURL=index.js.map
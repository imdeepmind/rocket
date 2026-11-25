/**
 * Constants for the SSO flow. These are deliberately not configurable: the
 * defaults are safe and every knob would be another way to weaken the flow.
 */
/** How long a started SSO flow stays valid. */
export declare const SSO_STATE_TTL_SECONDS = 600;
/** How long the one-time code handed back to the browser stays valid. */
export declare const SSO_EXCHANGE_CODE_TTL_SECONDS = 60;
/** `__Host-` requires a secure origin, host-only scope and `Path=/`. */
export declare const SSO_COOKIE_PREFIX = "__Host-ross_sso_";
/** Crypto domain-separation labels. */
export declare const SSO_STATE_INFO = "sso-state";
export declare const SSO_EXCHANGE_INFO = "sso-exchange";
export declare const SSO_EXCHANGE_AUDIENCE = "sso-exchange";
export declare const SSO_EXCHANGE_ISSUER = "ross";

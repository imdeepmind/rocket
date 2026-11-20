import {toNextJsHandler} from 'better-auth/next-js';

import {auth} from '@/app/lib/auth/auth';

export const {GET, POST} = toNextJsHandler(auth.handler);

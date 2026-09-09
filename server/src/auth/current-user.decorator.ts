import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload } from './auth.types.js';

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AccessTokenPayload => {
  return context.switchToHttp().getRequest<{ user: AccessTokenPayload }>().user;
});

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

type RequestWithSession = {
  session?: {
    user?: {
      emailVerified?: boolean;
    };
  } | null;
};

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('PUBLIC', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const isOptional = this.reflector.getAllAndOverride<boolean>('OPTIONAL', [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const user = request.session?.user;

    if (!user) {
      return true;
    }

    if (isOptional) {
      return true;
    }

    if (user.emailVerified) {
      return true;
    }

    throw new ForbiddenException({
      message: 'Email address must be verified before using this feature.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
}

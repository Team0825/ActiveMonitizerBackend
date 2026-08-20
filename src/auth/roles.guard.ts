import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import {
  AuthGuard,
} from '@nestjs/passport';

/*
 * ============================================================
 * ROLE TYPES
 * ============================================================
 */

export type UserRole =
  | 'STUDENT'
  | 'TEACHER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

/*
 * ============================================================
 * ROLES DECORATOR
 * ============================================================
 */

export const ROLES_KEY =
  'roles';

export const Roles = (
  ...roles: UserRole[]
) =>
  SetMetadata(
    ROLES_KEY,
    roles,
  );

/*
 * ============================================================
 * JWT + ROLE GUARD
 * ============================================================
 *
 * 1. Validates JWT
 * 2. Reads authenticated user from JWT
 * 3. Checks required role
 *
 * Role comparison is case-insensitive.
 *
 * Examples:
 *
 * ADMIN
 * admin
 * Admin
 *
 * are treated as ADMIN.
 * ============================================================
 */

@Injectable()
export class RolesGuard
  extends AuthGuard('jwt')
  implements CanActivate
{
  constructor(
    private readonly reflector:
      Reflector,
  ) {
    super();
  }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    /*
     * First validate JWT.
     *
     * AuthGuard('jwt') will attach
     * the validated JWT payload to:
     *
     * request.user
     */

    const isJwtValid =
      await super.canActivate(
        context,
      );

    if (!isJwtValid) {
      return false;
    }

    /*
     * Read required roles from
     * controller or route.
     */

    const requiredRoles =
      this.reflector
        .getAllAndOverride<
          UserRole[]
        >(
          ROLES_KEY,
          [
            context.getHandler(),
            context.getClass(),
          ],
        );

    /*
     * No @Roles() decorator means
     * any authenticated user is allowed.
     */

    if (
      !requiredRoles ||
      requiredRoles.length === 0
    ) {
      return true;
    }

    /*
     * Get authenticated user.
     */

    const request =
      context
        .switchToHttp()
        .getRequest();

    const user =
      request.user;

    if (
      !user ||
      !user.role
    ) {
      return false;
    }

    /*
     * Normalize JWT role.
     */

    const userRole =
      String(
        user.role,
      ).toUpperCase();

    const isSuperAdmin =
      user.isSuperAdmin === true ||
      userRole === 'SUPER_ADMIN';

    /*
     * Compare against allowed roles.
     */

    return requiredRoles.some(
      (role) =>
        role.toUpperCase() === userRole ||
        (isSuperAdmin && (role.toUpperCase() === 'ADMIN' || role.toUpperCase() === 'SUPER_ADMIN')),
    );
  }
}
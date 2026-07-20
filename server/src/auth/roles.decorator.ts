import { SetMetadata } from '@nestjs/common';
import type { UserRole } from './role.service';

export const ROLES_KEY = 'requiredRoles';

/** Обмежує маршрут переліком ролей. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/** Скорочення для найчастішого випадку. */
export const AdminOnly = () => Roles('admin');

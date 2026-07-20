import { Global, Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { AuthController } from './auth.controller';

/**
 * Global: RoleService потрібен і гарду (AppModule), і адмінським модулям.
 */
@Global()
@Module({
  controllers: [AuthController],
  providers: [RoleService],
  exports: [RoleService],
})
export class AuthModule {}

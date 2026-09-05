import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlatformBusinessesController } from './platform-businesses.controller';
import { PlatformBusinessesService } from './platform-businesses.service';

@Module({
  imports: [AuthModule],
  controllers: [PlatformBusinessesController],
  providers: [PlatformBusinessesService],
})
export class PlatformBusinessesModule {}

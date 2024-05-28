import { Module } from '@nestjs/common';
import { ChatModule } from './chat/chat.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { ConfigModule } from '@nestjs/config';
import {
  PrismaModule,
  providePrismaClientExceptionFilter,
} from 'nestjs-prisma';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { CqrsModule } from '@nestjs/cqrs';
import { UserModule } from './medias/medias.module';
import { DataProviderModule } from './data-providers/data-provider.module';

@Module({
  imports: [
    // Nest Modules
    CqrsModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    CacheModule.register({ isGlobal: true }),
    BullModule.forRoot({
      connection: { host: process.env['REDIS_HOST'] },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: true,
      },
    }),

    // Custom Modules
    AuthModule,
    ChatModule,
    DataProviderModule,
    EventsModule.forRoot({ isGlobal: true }),
    BlockchainModule.forRoot(),
    UserModule,
  ],
  providers: [providePrismaClientExceptionFilter()],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat, ChatMember, ChatMessage, ChatSeqTracker } from './entity/chat.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { User } from 'src/user/entity/user.entity';

@Module({
  imports: [
      TypeOrmModule.forFeature([Chat, ChatMember, ChatMessage, ChatSeqTracker, User]),
    ],
  exports: [TypeOrmModule],
  providers: [ChatService],
  controllers: [ChatController]
})
export class ChatModule {}

import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { AiChatMessageResponseGeneratedDto, AiScoreUpdatedDto } from './ai.dto';
import { EventsService } from 'src/events/events.service';
import { BaseDto } from '@lib/common';
import { randomUUID } from 'crypto';
import { ChatService } from 'src/chat/chat.service';
import { ChatId } from 'src/chat/domain/chat-id.value-object';
import { AiAdapter } from './ai.adapter';
import { LeaderBoardService } from 'src/chat/leaderboard.service';

const eventName = 'response_received';

export class ChatResponseGeneratedMessageDto extends BaseDto<ChatResponseGeneratedMessageDto> {
  type: 'message';
  id: string;
  chatId: string;
  message: string;
}

export class ChatResponseGeneratedTransactionDto extends BaseDto<ChatResponseGeneratedTransactionDto> {
  type: 'transaction';
  id: string;
  chatId: string;
  transaction: number[];
}

@Controller()
export class AiEventsController {
  private logger = new Logger(AiEventsController.name);

  constructor(
    private readonly eventsService: EventsService,
    private readonly aiAdapter: AiAdapter,
    private readonly chatService: ChatService,
    private readonly leaderBoardService: LeaderBoardService,
  ) {}

  @EventPattern(eventName)
  async process(event: AiChatMessageResponseGeneratedDto): Promise<void> {
    function replacer(key: string, value: any) {
      try {
        if (key === 'serialized_transaction') {
          return `[${value.slice(0, 2).join(', ')} ... (${value.length - 4} more) ... ${value
            .slice(-2)
            .join(', ')}]`;
        }
        return value;
      } catch (error) {
        return value;
      }
    }

    if (event.data.id) {
      await this.aiAdapter.setChatQueueId(
        new ChatId(event.chat_id),
        event.data.id,
      );
    }

    this.logger.debug(
      `Received event[${eventName}] from AI: ${JSON.stringify(event, replacer, 2)}`,
    );

    // Handle transaction
    if (event.data.serialized_transaction) {
      this.logger.debug(
        `Sending serializedTransaction[${event.data.serialized_transaction}] to user[${event.user.wallet_id}]`,
      );

      this.eventsService.sendTo(
        event.user.wallet_id,
        'chat.response-generated',
        new ChatResponseGeneratedTransactionDto({
          type: 'transaction',
          id: randomUUID(),
          transaction: event.data.serialized_transaction,
          chatId: event.chat_id,
        }),
      );
      return;
    }

    // Handle message
    if (event.data.message) {
      const { id } = await this.chatService.createChatMessageAiResponse(
        new ChatId(event.chat_id),
        event.data.message,
      );

      this.logger.debug(
        `Sending message[${event.data.message}] to user[${event.user.wallet_id}]`,
      );

      this.eventsService.sendTo(
        event.user.wallet_id,
        'chat.response-generated',
        new ChatResponseGeneratedMessageDto({
          type: 'message',
          id: id.value,
          message: event.data.message,
          chatId: event.chat_id,
        }),
      );
      return;
    }
  }

  @EventPattern('score_updated')
  async scoreUpdatedEventHandler(event: AiScoreUpdatedDto): Promise<void> {
    this.logger.debug(
      `Received event[score_updated] from AI: ${JSON.stringify(event, null, 2)}`,
    );

    await this.leaderBoardService.updateScore({
      chatId: event.chat_id,
      walletId: event.user.wallet_id,
      score: event.score,
    });
  }
}

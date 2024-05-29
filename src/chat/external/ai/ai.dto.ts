import { BaseDto } from '@lib/common';

export class AiChatMessageCreatedDto extends BaseDto<AiChatMessageCreatedDto> {
  chatId: string;
  user: {
    walletId: string;
  };
  data: {
    message: string;
    personality: string;
  };
  aux: AiAuxiliaryMessage;
}

export class AiChatMessageInfoCreatedDto extends BaseDto<AiChatMessageInfoCreatedDto> {
  chatId: string;
  user: {
    walletId: string;
  };
  data: {
    message: string;
  };
  aux: AiAuxiliaryMessage;
}

export class AiChatMessageResponseGeneratedDto extends BaseDto<AiChatMessageResponseGeneratedDto> {
  chat_id: string;
  user: {
    wallet_id: string;
  };
  data: {
    id?: string;
    message?: string;
    serialized_transaction?: number[];
  };
  aux: AiAuxiliaryMessage;
}

export type AiAuxiliaryMessage = {
  traceId: string;
};

// Score Updated
export class AiScoreUpdatedDto {
  chat_id: string;
  score: number;
  user: {
    wallet_id: string;
  };
}

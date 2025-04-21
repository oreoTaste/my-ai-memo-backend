import { OmitType, PartialType, PickType } from "@nestjs/swagger";
import { Chat, ChatMessage } from "../entity/chat.entity";
import { UserInfoDto } from "src/user/dto/user.dto";
import { IsOptional, IsString } from "class-validator";
import { CommonResultDto } from "src/common/dto/common.dto";

export class ChatMemberDto {
    createdAt?: Date;
    insertId?: number;
    modifiedAt?: Date;
    updateId?: number;
    chatSeq?: number;
    userId?: number;
    user: UserInfoDto;
}

export class ChatMessageDto extends PartialType(OmitType(ChatMessage, ['user'])) {
    user: UserInfoDto;
}
export class ChatListDto extends PickType(Chat, ['chatSeq', 'createdAt', 'insertId', 'modifiedAt', 'updateId'] as const){
    @IsOptional()
    members?: ChatMemberDto[];
}

export class ChatListResultDto extends CommonResultDto {
    constructor(chatListDto: ChatListDto[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.chatListDto = chatListDto ? chatListDto : null;
    }

    @IsOptional()
    chatListDto?: ChatListDto[];
}

export class ChatDetailDto extends PickType(ChatMessage, ['chatSeq'] as const) {}

export class ChatDetailResultDto extends CommonResultDto {
    constructor(chatMessageDto: ChatMessageDto[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.chatMessageDto = chatMessageDto ? chatMessageDto : null;
    }

    @IsOptional()
    chatMessageDto?: ChatMessageDto[];
}

export class CreateChatDto extends PartialType(PickType(Chat, ['title'])) {
    @IsString()
    userIdListJson: string;

}

export class InsertChatDto extends PickType(ChatMessage, ['chatSeq', 'message'] as const) {}
export class InsertChatResultDto extends CommonResultDto {
    constructor(chatMessageDto: ChatMessageDto[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.chatMessageDto = chatMessageDto ? chatMessageDto : null;
    }

    @IsOptional()
    chatMessageDto: ChatMessageDto[];

}



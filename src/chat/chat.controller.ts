import { Body, Controller, Delete, Get, Logger, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto } from 'src/user/dto/user.dto';
import { ChatDetailDto, ChatDetailResultDto, ChatListResultDto, CreateChatDto, InsertChatDto, InsertChatResultDto } from './dto/chat.dto';
import { CommonResultDto } from 'src/common/dto/common.dto';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService){} 

    @Get('list')
    async getChatList(@AuthUser() authUser: AuthUserDto) : Promise<ChatListResultDto>{
        let chatList = await this.chatService.listChat(authUser.id);
        return new ChatListResultDto(chatList);
    }

    @Post('detail')
    async getChatDetail(@AuthUser() authUser: AuthUserDto
                      , @Body() {chatSeq}: ChatDetailDto) : Promise<ChatDetailResultDto>{
        if(!chatSeq) {
            return new ChatDetailResultDto(null, false, ['please insert the chatSeq']); 
        }
        let chatDetail = await this.chatService.getChatDetail(authUser.id, chatSeq);
        return new ChatDetailResultDto(chatDetail);
    }

    @Post('create')
    async createChat(@AuthUser() authUser: AuthUserDto
                   , @Body() createChatDto: CreateChatDto) : Promise<ChatListResultDto>{
        try {
            let createdChat = await this.chatService.createChat(authUser.id, createChatDto);
            return new ChatListResultDto([createdChat]);                
        } catch (error) {
            Logger.error(`[createChat] ${error}`);
            return new ChatListResultDto([], false, error);            
        }
    }
    
    @Post('insert')
    async insertChatMessage(@AuthUser() authUser: AuthUserDto, @Body() {chatSeq, message} : InsertChatDto): Promise<InsertChatResultDto>{
        try {
            let messageDto = await this.chatService.insertChatMessage(authUser.id, chatSeq, message);
            return new InsertChatResultDto([messageDto]);    
        } catch(e) {
            Logger.error(`[ChatController.insertChatMessage] ${e}`);
            return new InsertChatResultDto([], false, ['failed to insert chat messages']);
        }
    }
    @Delete('delete')
    async deleteChat(@AuthUser() authUser: AuthUserDto, @Body() {chatSeq}) : Promise<CommonResultDto>{
        let isDeleted = await this.chatService.deleteChat(authUser.id, chatSeq);
        if(isDeleted) {
            return new CommonResultDto(true, ['succeed']);
        }
        return new CommonResultDto(false, ['failed to delete chat']);
    }

}
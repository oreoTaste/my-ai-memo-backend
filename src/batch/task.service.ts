import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import { SearchTodoResultDto, TodoDto } from 'src/todo/dto/todo.dto';
import { TodoService } from 'src/todo/todo.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class TaskService {
    private readonly logger = new Logger(TaskService.name);
    constructor(private readonly todoService: TodoService, private readonly userService: UserService) {}

    @Cron('0 0 9 * * *', {
        timeZone: 'Asia/Seoul', // 한국 표준시 기준
    })
    async sendDailyTodos() {
      for(let todo of (await this.getTodos()).todo) {
        await this.sendMessage(todo);
      }
    }

    async getTodos(): Promise<SearchTodoResultDto> {
      let now = new Date();
      let todayString = `${now.getFullYear()}${1+now.getMonth() < 10 ? "0": ""}${1+now.getMonth()}${now.getDate() < 10 ? "0": ""}${now.getDate()}`
      let tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
      let tomorrowString = `${tomorrow.getFullYear()}${1+tomorrow.getMonth() < 10 ? "0": ""}${1+tomorrow.getMonth()}${tomorrow.getDate() < 10 ? "0": ""}${tomorrow.getDate()}`
      return await this.todoService.searchTodos(null, {"dateStart": todayString, "dateEnd": tomorrowString});
    }
    async sendMessage(todo : TodoDto) {
      try {
        let telegramId = await (await this.userService.retreiveUserBySeq(todo.insertId))?.telegramId || null;
        if(telegramId) {
          let message = `[${todo.title}] ${todo.desc}`;
        
          let body = {
            "chat_id": telegramId,
            "text":message
          }
          let url = `https://api.telegram.org/bot7816669459:AAH_ikh2U6nfcEohVpLf0vMLUpQdN5t06iE/sendMessage`
  
            // axios로 요청 보내기
            const response = await axios.post(url, body);
            this.logger.log(`Message sent successfully: ${response.status}`);  
        }
      } catch (error) {
        this.logger.error(`Failed to send message: ${error.message}`);
      }
    }
}
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosInstance } from 'axios';
import { Code } from 'src/code/entity/code.entity';
import { Todo } from 'src/todo/entity/todo.entity';
import { Like, Repository } from 'typeorm';

interface TodoWithUserInfo {
  todo: Todo;
  telegramId: string;
  loginId: string;
}

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);
  private telegramBotToken: string; // 필드로 유지하지만 초기화는 하지 않음
  private telegramApi: AxiosInstance;

  constructor(
    @InjectRepository(Todo) private todoRepository: Repository<Todo>,
    @InjectRepository(Code) private codeRepository: Repository<Code>,
  ) {
    // 초기화는 하지 않고, 필요할 때마다 가져오도록 설정
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM, { timeZone: 'Asia/Seoul' })
  async initializeAPIKEYS(): Promise<void> {
    this.logger.log('[1AM] InitializeAPIKEYS batch started');
    try {
      await this.codeRepository.manager.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .update(Code)
          .set({ codeDesc: '0' })
          .where({
            codeGroup: 'CC004',
            code: Like('API_KEY%'),
            useYn: 'Y',
          })
          .execute();
      });
      this.logger.log('API Keys initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize API Keys', error.stack);
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM, { timeZone: 'Asia/Seoul' })
  async sendDailyTodos(): Promise<void> {
    this.logger.log('[9AM] SendDailyTodos batch started');
    await this.initializeTelegramApi();

    const todosWithUsers = await this.getTodos();
    await Promise.all(
      todosWithUsers.map(item =>
        this.sendMessage(item).catch(error => {
          this.logger.error(`Failed to send message for todo# ${item.todo.seq}: ${item.todo.title}`, error.stack);
        }),
      ),
    );
  }

  private async getTodos(): Promise<TodoWithUserInfo[]> {
    const now = new Date();
    const todayString = now.toISOString().split('T')[0].replace(/-/g, '');

    const queryBuilder = this.todoRepository
      .createQueryBuilder('todo')
      .innerJoin('Y_USER', 'user', 'todo.INSERT_ID = user.ID')
      .select('todo')
      .addSelect('"user".TELEGRAM_ID', 'TELEGRAM_ID')
      .addSelect('"user".LOGIN_ID', 'LOGIN_ID')
      .where('todo.YYYYMMDD = :todayString', { todayString })
      .andWhere('"user".TELEGRAM_ID IS NOT NULL');;

    const rawResults = await queryBuilder.getRawAndEntities();

    return rawResults.entities.map((todo, index) => {
      const raw = rawResults.raw[index];
      return {
        todo,
        telegramId: raw.telegramId,
        loginId: raw.loginId,
      };
    });
  }

  private async sendMessage(item: TodoWithUserInfo): Promise<void> {
    const { todo, telegramId, loginId } = item;

    if (!telegramId) {
      this.logger.warn(`No valid telegramId found for user ${loginId || 'unknown'}`);
      return;
    }

    const message = `[${todo.title}]\n${todo.description}`;
    try {
      const response = await this.telegramApi.post('/sendMessage', {
        chat_id: telegramId,
        text: message,
      });
      this.logger.log(`Message sent successfully to ${telegramId}: ${response.status}`);
    } catch (error) {
      this.logger.error(`Failed to send message to ${telegramId}`);
      throw error;
    }
  }

  private async getTelegramBotToken(): Promise<string> {
    try {
      const telegramCode = await this.codeRepository.findOne({
        where: {
          codeGroup: 'CC004',
          code: 'TELEGRAM',
          useYn: 'Y',
        },
        select: ['remark'],
      });

      if (!telegramCode || !telegramCode.remark) {
        throw new Error('Telegram bot token not found in CODE table');
      }

      return telegramCode.remark;
    } catch (error) {
      this.logger.error('Failed to fetch Telegram bot token', error.stack);
      throw error;
    }
  }

  private async initializeTelegramApi(): Promise<void> {
    this.telegramBotToken = await this.getTelegramBotToken();
    this.telegramApi = axios.create({
      baseURL: `https://api.telegram.org/bot${this.telegramBotToken}`,
      timeout: 5000,
    });
  }
}
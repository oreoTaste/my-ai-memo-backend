import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { TodoService } from './todo.service';
import { DeleteTodoDto, DeleteTodoResultDto, InsertTodoDto, InsertTodoResultDto, SearchTodoDto, SearchTodoResultDto, UpdateTodoDto, UpdateTodoResultDto } from './dto/todo.dto';

@Controller("todo")
export class TodoController {
  constructor(private readonly todoService: TodoService) {}

  @Get('list')
  async listTodo(@AuthUser() authUser, @Query() searchMonthTodoDto: SearchTodoDto) : Promise<SearchTodoResultDto> {
    return await this.todoService.searchTodos(authUser.id, searchMonthTodoDto);
  }

  @Post('insert')
  async insertTodo(@AuthUser() authUser, @Body() insertTodoDto: InsertTodoDto) : Promise<InsertTodoResultDto> {
    return await this.todoService.insertTodos(authUser.id, insertTodoDto);
  }
  
  @Post('delete')
  async deleteTodo(@AuthUser() authUser, @Body() deleteTodoDto: DeleteTodoDto) : Promise<DeleteTodoResultDto> {
    return await this.todoService.deleteTodos(authUser.id, deleteTodoDto);
  }

  @Post('update')
  async updateTodo(@AuthUser() authUser, @Body() updateTodoDto: UpdateTodoDto) : Promise<UpdateTodoResultDto> {
    return await this.todoService.updateTodoDto(authUser.id, updateTodoDto);
  }
  
}

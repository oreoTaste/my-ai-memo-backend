import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, Between, FindOperator, LessThan, MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Todo } from './entity/todo.entity';
import { DeleteTodoDto, DeleteTodoResultDto, InsertTodoDto, InsertTodoResultDto, SearchTodoDto, SearchTodoResultDto, UpdateTodoDto, UpdateTodoResultDto } from './dto/todo.dto';

@Injectable()
export class TodoService {
  constructor(
    @InjectRepository(Todo)
    private todoRepository: Repository<Todo>,
  ) {}

  /**
   * @description todo검색
   */
  async searchTodos(loginId: number, searchTodoDto: SearchTodoDto):Promise<SearchTodoResultDto> {
    searchTodoDto.dateStart = searchTodoDto.dateStart.replaceAll(/[-]/g, "");
    searchTodoDto.dateEnd = searchTodoDto.dateEnd.replaceAll(/[-]/g, "");
    let searchBody = {};

    if(loginId){
      searchBody['insertId'] = loginId;
    }
    if(searchTodoDto.dateStart && searchTodoDto.dateEnd) {
        searchBody['date'] = And(MoreThanOrEqual(searchTodoDto.dateStart), LessThan(searchTodoDto.dateEnd));
    }
    let rslt = await this.todoRepository.find({where: searchBody, order: {date: 'ASC'}});
    rslt.map(el => {el.date = el.date.substring(0, 4) + "-" + el.date.substring(4, 6) + "-" + el.date.substring(6, 8)});
    console.log(rslt);
    return new SearchTodoResultDto(rslt);
  }

  /**
   * @description todo입력
   */
  async insertTodos(loginId: number, {date, desc, title}: InsertTodoDto):Promise<InsertTodoResultDto> {
    date = date.replaceAll(/[-]/g, "");
    let rslt = await this.todoRepository.insert({
      date, desc, title, insertId: loginId, updateId: loginId
    });
    return new InsertTodoResultDto(rslt);
  }
  /**
   * @description todo삭제
   */
  async deleteTodos(loginId: number, {seq}: DeleteTodoDto):Promise<DeleteTodoResultDto> {
    if(loginId) {
      let todo = await this.todoRepository.findOne({where: {seq}});
      if(!todo) {
        return new DeleteTodoResultDto(null, false, ['failed to find the todo']);
      }
      let rslt = await this.todoRepository.delete({seq});
      return new DeleteTodoResultDto(rslt);
    }
    return new DeleteTodoResultDto(null, false, ['please login first']);
  }
  /**
   * @description todo수정
   */
  async updateTodoDto(loginId: number, updateTodoDto: UpdateTodoDto):Promise<UpdateTodoResultDto> {
    if(loginId) {
      updateTodoDto.date = updateTodoDto.date.replaceAll(/[-]/g, "");
      let todo = await this.todoRepository.findOne({where: {seq : updateTodoDto.seq}});
      if(!todo) {
        return new UpdateTodoResultDto(null, false, ['failed to find the todo']);
      }
      todo.date = updateTodoDto.date;
      todo.desc = updateTodoDto.desc;
      todo.title = updateTodoDto.title;
      let rslt = await this.todoRepository.update({seq: updateTodoDto.seq}, todo);
      return new UpdateTodoResultDto(rslt);
    }
    return new UpdateTodoResultDto(null, false, ['please login first']);
  }
  
  
}

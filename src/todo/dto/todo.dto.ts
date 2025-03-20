import { OmitType, PartialType, PickType } from "@nestjs/swagger";
import { CommonResultDto } from "src/common/dto/common.dto";
import { IsOptional, IsString, Length } from "class-validator";
import { Todo } from "../entity/todo.entity";
import { DeleteResult, InsertResult, UpdateResult } from "typeorm";

export class SearchTodoDto {
    @IsString()
    @Length(10)
    dateStart: string;

    @IsString()
    @Length(10)
    dateEnd: string;
}
export class InsertTodoDto extends OmitType(Todo, ['seq', "createdAt", "insertId", "updateId", "modifiedAt"] as const){}
export class UpdateTodoDto extends OmitType(Todo, ["createdAt", "insertId", "updateId", "modifiedAt"] as const){}
export class DeleteTodoDto extends PickType(Todo, ["seq"] as const){}

export class InsertTodoResultDto extends CommonResultDto {
    constructor(insertResult: InsertResult, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.insertResult = insertResult ? insertResult : null;
    }

    @IsOptional()
    insertResult?: InsertResult;
}
export class TodoDto extends Todo{
    @Length(10)
    yyyymmdd: string;
}
export class SearchTodoResultDto extends CommonResultDto {
    constructor(todo: TodoDto[], result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.todo = todo ? todo : null;
    }

    @IsOptional()
    todo?: TodoDto[];
}
export class UpdateTodoResultDto extends CommonResultDto {
    constructor(updateResult: UpdateResult, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.updateResult = updateResult ? updateResult : null;
    }

    @IsOptional()
    updateResult?: UpdateResult;
}    
export class DeleteTodoResultDto extends CommonResultDto {
    constructor(deleteResult: DeleteResult, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.deleteResult = deleteResult ? deleteResult : null;
    }

    @IsOptional()
    deleteResult?: DeleteResult;
}
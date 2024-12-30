import { CommonResultDto } from "src/common/dto/common.dto";
import { IsOptional } from "class-validator";

export class ExecuteQueryDto {
  query: string;
  params: string[];
}

export class ExecuteQueryResultDto extends CommonResultDto {
    constructor(queryResult: any, result?: boolean, message?: string[]) {
        super(result == undefined ? true : result
            , message == undefined ? ['success'] : message);
        this.queryResult = queryResult ? queryResult : null;
    }

    @IsOptional()
    queryResult?: any;
}

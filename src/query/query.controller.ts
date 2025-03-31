import { Body, Controller, Logger, Post } from '@nestjs/common';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto } from 'src/user/dto/user.dto';
import { DataSource } from "typeorm"
import { ExecuteQueryDto, ExecuteQueryResultDto } from './dto/query.dto';

@Controller('query')
export class QueryController {
    constructor(private readonly dataSource: DataSource) {}

    @Post('execute')
    async executeQuery(@AuthUser() authUser: AuthUserDto, @Body() executeQueryDto: ExecuteQueryDto) {
        if(authUser) {
            Logger.debug("executeQueryDto");
            Logger.debug(executeQueryDto);
            const rawData = await this.dataSource.query(executeQueryDto.query, executeQueryDto.params);
            Logger.debug(rawData);
            return new ExecuteQueryResultDto(rawData);
        }
        return new ExecuteQueryResultDto(null, false, ["failed to execute query"]);
    }

}

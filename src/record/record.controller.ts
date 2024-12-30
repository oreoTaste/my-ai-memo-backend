import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto } from 'src/user/dto/user.dto';
import { InsertRecordDto, InsertRecordResultDto, SearchRecordResultDto } from './dto/record.dto';
import { RecordService } from './record.service';

@Controller('record')
export class RecordController {
    constructor(private readonly recordService: RecordService){} 

    @Post('insert')
    async insertRecord(@AuthUser() authUser: AuthUserDto,
               @Body() insertRecordDto: InsertRecordDto) : Promise<InsertRecordResultDto> {
        if(authUser) {
            const insertResult = await this.recordService.insertRecord(authUser.id, insertRecordDto);
            if(insertResult){
                return new InsertRecordResultDto(insertResult.raw);
            } else {
                return new InsertRecordResultDto(null, false, ["couldn't find the correct record typeCode"]);
            }
        }
        return new InsertRecordResultDto(null, false, ["couldn't insert record"]);
    }

    @Get('list')
    async listRecord(@AuthUser() authUser: AuthUserDto) : Promise<SearchRecordResultDto> {
        const searchRecord = await this.recordService.searchRecord(authUser.id, {});
        return new SearchRecordResultDto(searchRecord);
    }


}

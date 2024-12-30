import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common';
import { CodeService } from './code.service';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto } from 'src/user/dto/user.dto';
import { DeleteCodeDto, DeleteCodeGroupDto, DeleteCodeGroupResultDto, DeleteCodeResultDto, InsertCodeDto, InsertCodeGroupDto, InsertCodeGroupResultDto, InsertCodeResultDto, SearchCodeDto, SearchCodeGroupDto, SearchCodeGroupResultDto, SearchCodeResultDto, UpdateCodeDto, UpdateCodeResultDto } from './dto/code.dto';

@Controller('code')
export class CodeController {
    constructor(private readonly codeService: CodeService){} 

    @Get('codegroup-list')
    async searchCodeGroup(@AuthUser() authUser: AuthUserDto,
                     @Query() searchCodeGroupDto: SearchCodeGroupDto) : Promise<SearchCodeGroupResultDto>{
        if(authUser.adminYn !== "Y") {
            return new SearchCodeGroupResultDto(null, false, ["Not allowed to search codegroup"]);
        }
        if(authUser) {
            return await this.codeService.searchCodeGroup(authUser.id, searchCodeGroupDto);
        }
        return new SearchCodeGroupResultDto(null, false, ["couldn't find any code group"]);
    }

    @Post('codegroup-insert')
    async insertCodeGroup(@AuthUser() authUser: AuthUserDto,
                          @Body() insertCodeGroupDto: InsertCodeGroupDto) : Promise<InsertCodeGroupResultDto>{
        if(authUser) {
            return await this.codeService.insertCodeGroup(authUser.id, insertCodeGroupDto);
        }
        return new InsertCodeGroupResultDto(null, false, ["failed to insert code"]);
    }

    @Post('codegroup-delete')
    async deleteCodeGroup(@AuthUser() authUser: AuthUserDto,
                          @Body() deleteCodeGroupDto: DeleteCodeGroupDto) : Promise<DeleteCodeGroupResultDto>{
        if(authUser) {
            return await this.codeService.deleteCodeGroup(authUser.id, deleteCodeGroupDto);
        }
        return new DeleteCodeGroupResultDto(null, false, ["failed to delete code"]);
    }


    @Get('code-list')
    async searchCode(@AuthUser() authUser: AuthUserDto,
                     @Query() searchCodeDto: SearchCodeDto) : Promise<SearchCodeResultDto>{
        if(!searchCodeDto.code && !searchCodeDto.codeGroup && !searchCodeDto.codeDesc) {
            return new SearchCodeResultDto(null, false, ["please check search options"]);
        }
        if(authUser) {
            return await this.codeService.searchCode(authUser.id, searchCodeDto);
        }
        return new SearchCodeResultDto(null, false, ["couldn't find any code"]);
    }

    @Post('code-insert')
    async insertCode(@AuthUser() authUser: AuthUserDto,
                     @Body() insertCodeDto: InsertCodeDto) : Promise<InsertCodeResultDto>{
        if(authUser) {
            return await this.codeService.insertCode(authUser.id, insertCodeDto);
        }
        return new InsertCodeResultDto(null, false, ["failed to insert code"]);
    }

    @Post('code-update')
    async updateCode(@AuthUser() authUser: AuthUserDto,
                     @Body() updateCodeDto: UpdateCodeDto) : Promise<UpdateCodeResultDto>{
        if(authUser) {
            return await this.codeService.updateCode(authUser.id, updateCodeDto);
        }
        return new UpdateCodeResultDto(null, false, ["failed to update code"]);
    }


    @Post('code-delete')
    async deleteCode(@AuthUser() authUser: AuthUserDto,
                     @Body() deleteCodeDto: DeleteCodeDto) : Promise<DeleteCodeResultDto>{
        if(authUser) {
            return await this.codeService.deleteCode(authUser.id, deleteCodeDto);
        }
        return new DeleteCodeResultDto(null, false, ["failed to update code"]);
    }
}
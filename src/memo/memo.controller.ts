import { Body, Controller, Delete, Get, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { MemoService } from './memo.service';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto } from 'src/user/dto/user.dto';
import { DeleteMemoResultDto, InsertMemoDto, InsertMemoResultDto, SearchMemoDto, SearchMemoResultDto, UpdateMemoDto, UpdateMemoResultDto } from './dto/memo.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from 'src/file/file.service';

@Controller('memo')
export class MemoController {
    constructor(private readonly memoService: MemoService, 
                private readonly fileService: FileService
            ){} 

    @Get('list')
    async searchMemo(@AuthUser() authUser: AuthUserDto,
             @Query() searchMemoDto: SearchMemoDto) : Promise<SearchMemoResultDto>{
        if(authUser) {
            let memos = await this.memoService.searchMemo(authUser.id, searchMemoDto);

            for (let memo of memos) {
                let fileName = await this.fileService.searchFileNames({ fileFrom: "MEMO", seq: memo.seq });
                memo['files'] = fileName || [];
            }            
            return new SearchMemoResultDto(memos);
        }
        return new SearchMemoResultDto(null, false, ["couldn't find any memo"]);
    }

    @Post('insert')
    @UseInterceptors(FilesInterceptor('files'))
    async insertMemo(@AuthUser() authUser: AuthUserDto,
                     @Body() insertMemoDto: InsertMemoDto,
                     @UploadedFiles() files: Array<Express.Multer.File>) : Promise<InsertMemoResultDto> {
        // if(authUser) {
            const insertResult = await this.memoService.insertMemo(1, insertMemoDto);
            try {
                for(let file of files) {
                    if (!file.path) {
                    console.error('File is undefined.');
                    throw new Error('File is undefined.');
                    }
                }            
                await this.fileService.insertFiles(1, files, "MEMO", insertResult.raw.seq);
            } catch (error) {
                console.error('Error saving file:', error);
                return new InsertMemoResultDto(insertResult.raw, false, ['failed to save file']);
            }
            return new InsertMemoResultDto(insertResult.raw);
        // }
        // return new InsertMemoResultDto(null, false, ["couldn't insert memo"]);
    }

    @Post('update')
    async updateMemo(@AuthUser() authUser: AuthUserDto,
                     @Body() updateMemoDto: UpdateMemoDto) : Promise<UpdateMemoResultDto> {
        if(authUser) {
            const updateResult = await this.memoService.updateMemo(authUser.id, updateMemoDto);
            return new UpdateMemoResultDto(updateResult);
        }
        return new UpdateMemoResultDto(null, false, ["couldn't update memo"]);
    }

    @Delete('delete')
    async deleteMemo(@AuthUser() authUser: AuthUserDto,
                     @Query('seq') seq: number
                    ) : Promise<DeleteMemoResultDto> {
        if(authUser) {
            const memoToDelete = await this.memoService.searchMemo(authUser.id, { seq });
            if(memoToDelete.length == 1) {
                const deleteResult = await this.memoService.deleteMemo(seq);
                await this.fileService.deleteFiles("MEMO", seq);
                return new DeleteMemoResultDto(deleteResult);
            } else {
                return new DeleteMemoResultDto(null, false, ["couldn't find the exact memo"]);
            }
        }
        return new DeleteMemoResultDto(null, false, ["couldn't delete memo"]);
    }

}

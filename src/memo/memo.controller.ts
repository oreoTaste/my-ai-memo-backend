import { Body, Controller, Delete, Get, Logger, Post, Query, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { MemoService } from './memo.service';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto } from 'src/user/dto/user.dto';
import { DeleteMemoResultDto, GetMemoAdviceDto, GetMemoAdviceResultDto, InsertMemoDto, InsertMemoResultDto, SearchMemoDto, SearchMemoResultDto, UpdateMemoDto, UpdateMemoResultDto } from './dto/memo.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FileService } from 'src/file/file.service';
import { AIAnalyzerService } from 'src/common/ai-analyzer.service';
import { getAPIKeyResultDto } from 'src/common/dto/common.dto';

@Controller('memo')
export class MemoController {
    constructor(private readonly memoService: MemoService, 
                private readonly fileService: FileService,
                private readonly aiAnalyzer: AIAnalyzerService
            ){}

    @Get('list')
    async searchMemo(@AuthUser() authUser: AuthUserDto,
             @Query() searchMemoDto: SearchMemoDto) : Promise<SearchMemoResultDto>{
        if(!authUser) {
            return new SearchMemoResultDto(null, false, ['please login first']);
        }
        let memos = await this.memoService.searchMemo(authUser.id, searchMemoDto);

        for (let memo of memos) {
            let fileName = await this.fileService.searchFileNames({ fileFrom: "MEMO", seq: memo.seq }, 0);
            memo['files'] = fileName || [];
        }            
        return new SearchMemoResultDto(memos);    
    }

    @Post('insert')
    @UseInterceptors(FilesInterceptor('files'))
    async insertMemo(@AuthUser() authUser: AuthUserDto,
                     @Body() insertMemoDto: InsertMemoDto,
                     @UploadedFiles() files: Array<Express.Multer.File>) : Promise<InsertMemoResultDto> {
        if(!authUser) {
            return new InsertMemoResultDto(null, authUser.id, false, ['please login first']);
        }
        const insertResult = await this.memoService.insertMemo(authUser.id, insertMemoDto);
        try {
            for(let file of files) {
                if (!file.path) {
                    Logger.error('File is undefined.');
                    throw new Error('File is undefined.');
                }
            }            
            await this.fileService.insertFiles(authUser.id, files, "MEMO", insertResult.raw.seq);
        } catch (error) {
            Logger.error('Error saving file:', error);
            return new InsertMemoResultDto(insertResult.raw, authUser.id, false, ['failed to save file']);
        }
        return new InsertMemoResultDto(insertResult.raw, authUser.id);    
    }

    @Post('update')
    async updateMemo(@AuthUser() authUser: AuthUserDto,
                     @Body() updateMemoDto: UpdateMemoDto) : Promise<UpdateMemoResultDto> {
        if(!authUser) {
            return new UpdateMemoResultDto(null, false, ['please login first']);
        }

        const updateResult = await this.memoService.updateMemo(authUser.id, updateMemoDto);
        return new UpdateMemoResultDto(updateResult);    
    }

    @Delete('delete')
    async deleteMemo(@AuthUser() authUser: AuthUserDto,
                     @Query('seq') seq: number
                    ) : Promise<DeleteMemoResultDto> {
        if(!authUser) {
            return new DeleteMemoResultDto(null, false, ['please login first']);
        }
        const memoToDelete = await this.memoService.searchMemo(authUser.id, { seq });
        if(memoToDelete.length == 1) {
            try {
                await this.fileService.deleteFiles("MEMO", seq, authUser.id);
            } catch(e) {
                Logger.error(`failed to delete files of memo#: ${seq}`);
            }

            // db에서 삭제
            const deleteResult = await this.memoService.deleteMemo(seq);
            Logger.debug(`succeed to delete memo in db (${seq})`);

            return new DeleteMemoResultDto(deleteResult);
        } else {
            return new DeleteMemoResultDto(null, false, ["couldn't find the exact memo"]);
        }
    }

    @Post('get-api-key')
    async getAPIkey(@AuthUser() authUser: AuthUserDto): Promise<getAPIKeyResultDto> {
        if(!authUser) {
            return new getAPIKeyResultDto(null, false, ['please login first']);
        }

        let apiKey = (await this.aiAnalyzer.getAPIKeys(1))[0].API_KEY;
        // 추출한 API_KEY는 사용처리
        let usageMap = new Map();
        usageMap.set(apiKey, 1);
        await this.aiAnalyzer.updateStatusOfAPIKeys(usageMap);

        return new getAPIKeyResultDto(apiKey);
    }

    @Post('analyze')
    async analyze(@AuthUser() authUser: AuthUserDto,
                  @Query('seq') seq: number
                  ): Promise<void> {
        if(!authUser) {
            return;
        }

        let files = await this.fileService.searchFileNames({fileFrom: "MEMO", seq}, 1);
        this.aiAnalyzer.analyzeFiles(files, seq, authUser.id);    
    }

    @Post('get-advice')
    @UseInterceptors(FilesInterceptor('files'))
    async getMemoAdvice(@AuthUser() authUser: AuthUserDto,
                        @Body() getMemoAdviceDto: GetMemoAdviceDto,
                        @UploadedFiles() files: Array<Express.Multer.File>): Promise<GetMemoAdviceResultDto> {
        if(!authUser) {
            return new GetMemoAdviceResultDto(null, null, false, ['please login first']);
        }

        let result = await this.aiAnalyzer.getAdvice(getMemoAdviceDto, files);
        return new GetMemoAdviceResultDto(result.advice, result.subject);
    }    

}

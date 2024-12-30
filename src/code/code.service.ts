import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Code, CodeGroup } from './entity/code.entity';
import { DeleteCodeDto, DeleteCodeGroupDto, DeleteCodeGroupResultDto, DeleteCodeResultDto, InsertCodeDto, InsertCodeGroupDto, InsertCodeGroupResultDto, InsertCodeResultDto, SearchCodeDto, SearchCodeGroupDto, SearchCodeGroupResultDto, SearchCodeResultDto, UpdateCodeDto, UpdateCodeResultDto } from './dto/code.dto';
import { User } from 'src/user/entity/user.entity';

@Injectable()
export class CodeService {
    constructor(
        @InjectRepository(CodeGroup)
        private codeGroupRepository: Repository<CodeGroup>,
        @InjectRepository(Code)
        private codeRepository: Repository<Code>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ){}

    private setCodeGroup(loginId: number, insertCodeDto : InsertCodeDto | InsertCodeGroupDto) : CodeGroup {
        let newCodeGroup = new CodeGroup();
        newCodeGroup.codeGroup = insertCodeDto.codeGroup; // 공통코드 그룹의 코드

        if("codeGroupDesc" in insertCodeDto) { // 공통코드 그룹의 설명
            newCodeGroup.codeDesc = insertCodeDto.codeGroupDesc; 
        } else if ("codeDesc" in insertCodeDto){
            newCodeGroup.codeDesc = insertCodeDto.codeDesc;
        }
        newCodeGroup.updateId = newCodeGroup.insertId = loginId;
        newCodeGroup.modifiedAt = newCodeGroup.createdAt = new Date();
        newCodeGroup.useYn = "Y"; // 사용여부
        return newCodeGroup;
    }
    private setCode(loginId: number, insertCodeDto : InsertCodeDto) : Code {
        let newCode = new Code();
        newCode.code = insertCodeDto.code;
        newCode.codeGroup = insertCodeDto.codeGroup; // 공통코드 그룹의 코드
        newCode.codeDesc = insertCodeDto.codeDesc; // 공통코드 그룹의 설명
        newCode.updateId = newCode.insertId = loginId;
        newCode.modifiedAt = newCode.createdAt = new Date();
        newCode.useYn = "Y"; // 사용여부
        newCode.remark = insertCodeDto.remark; // 비고
        return newCode;
    }

    async searchCodeGroup(loginId: number, searchCodeGroupDto: SearchCodeGroupDto):Promise<SearchCodeGroupResultDto> {
        let searchBody = {};
        if(searchCodeGroupDto.codeGroup) {
            searchBody['codeGroup'] = searchCodeGroupDto.codeGroup;
        }
        if(searchCodeGroupDto.codeDesc) {
            searchBody['codeDesc'] = Like(searchCodeGroupDto.codeDesc);
        }
        let rslt = await this.codeGroupRepository.find({where: searchBody, order: {codeGroup: 'ASC', codeDesc: 'ASC'}});
        return new SearchCodeGroupResultDto(rslt);
    }

    async insertCodeGroup(loginId: number, insertCodeGroupDto: InsertCodeGroupDto):Promise<InsertCodeGroupResultDto> {
        let adminYn = (await this.userRepository.findOneBy({id: loginId})).adminYn
        if(adminYn == "Y") {
            // 공통코드 그룹
            let codeGroup = await this.codeGroupRepository.findOne({where: {codeGroup: insertCodeGroupDto.codeGroup}});
            if(codeGroup) {
                return new InsertCodeGroupResultDto(0, false, ["already code inserted"]);
            }
            // 공통코드가 비어있을 경우 insert
            let newCodeGroup = this.setCodeGroup(loginId, insertCodeGroupDto);
            let rslt = await this.codeGroupRepository.insert(newCodeGroup);
            Logger.debug(`codeGroup 신규 입력 : ${insertCodeGroupDto.codeGroup}`);
            return new InsertCodeGroupResultDto(rslt?.identifiers?.length);
        }
        return new InsertCodeResultDto(0, false, ['not allowed to delete the code']);
    }
    async deleteCodeGroup(loginId: number, deleteCodeGroupDto: DeleteCodeGroupDto):Promise<DeleteCodeGroupResultDto> {
        let adminYn = (await this.userRepository.findOneBy({id: loginId})).adminYn
        if(adminYn == "Y") {
            let codeGroup = await this.codeGroupRepository.findOne({where: {codeGroup: deleteCodeGroupDto.codeGroup}});
            if(!codeGroup) {
                return new DeleteCodeGroupResultDto(0, false, ['failed  to find the code']);
            }
            let rslt = await this.codeGroupRepository.delete({codeGroup: deleteCodeGroupDto.codeGroup});
            Logger.debug(`codeGroup 삭제 : ${deleteCodeGroupDto.codeGroup}`);
            return new DeleteCodeGroupResultDto(rslt?.affected);
        }
        return new DeleteCodeGroupResultDto(0, false, ['not allowed to delete the code']);
    }
        

    async searchCode(loginId: number, searchCodeDto: SearchCodeDto):Promise<SearchCodeResultDto> {
        try {
            let adminYn = (await this.userRepository.findOneBy({id: loginId})).adminYn
            if(adminYn) {
                let searchBody = {};
                if(searchCodeDto.code) {
                    searchBody['code'] = searchCodeDto.code;
                }
                if(searchCodeDto.codeDesc) {
                    searchBody['codeDesc'] = searchCodeDto.codeDesc;
                }
                if(searchCodeDto.codeGroup) {
                    searchBody['codeGroup'] = searchCodeDto.codeGroup;
                }
                if(searchCodeDto.remark) {
                    searchBody['remark'] = searchCodeDto.remark;
                }
                if(searchCodeDto.useYn) {
                    searchBody['useYn'] = searchCodeDto.useYn;
                }
                let codeGroup = await this.codeRepository.find({where: searchBody, order: {codeGroup: "ASC", code: "ASC"}, take: 100});
                return new SearchCodeResultDto(codeGroup);
            } else {
                return new SearchCodeResultDto(null, false, ['cannot access to code infos']);
            }
        } catch(e) {
            return new SearchCodeResultDto(null, false, ['failed to retrive data regarding code infos']);
        }
    }

    async insertCode(loginId: number, insertCodeDto: InsertCodeDto):Promise<InsertCodeResultDto> {
        let adminYn = (await this.userRepository.findOneBy({id: loginId})).adminYn
        if(adminYn == "Y") {
            // 공통코드
            if(insertCodeDto.code) {
                let code = await this.codeRepository.findOne({where: {codeGroup: insertCodeDto.codeGroup, code: insertCodeDto.code}});
                if(code) {
                    return new InsertCodeResultDto(0, false, ["code already exist"]);
                }
                let newCode = this.setCode(loginId, insertCodeDto);
                let rslt = await this.codeRepository.insert(newCode);
                if(rslt?.identifiers?.length > 0) {
                    Logger.debug(`code 신규 입력 : ${insertCodeDto.code}`);
                    return new InsertCodeResultDto(rslt?.identifiers?.length);
                }
                return new InsertCodeResultDto(rslt?.identifiers?.length, false, ["code already exist"]);
            }
            return new InsertCodeResultDto(0);
        }
        return new InsertCodeResultDto(0, false, ['not allowed to delete the code']);
    }
    async updateCode(loginId: number, updateCodeDto: UpdateCodeDto):Promise<UpdateCodeResultDto> {
        let adminYn = (await this.userRepository.findOneBy({id: loginId})).adminYn
        if(adminYn == "Y") {
            let foundCode = await this.codeRepository.findOne({where: {code: updateCodeDto.code, codeGroup: updateCodeDto.codeGroup}})
            if(!foundCode) {
                return new UpdateCodeResultDto(0, false, ['failed to find the code']);
            }
            let rslt = await this.codeRepository.update({code: updateCodeDto.code, codeGroup: updateCodeDto.codeGroup}, {...foundCode, codeDesc: updateCodeDto.codeDesc});
            if(rslt.affected > 0) {
                return new UpdateCodeResultDto(rslt.affected);
            }
            return new UpdateCodeResultDto(0, false, ['failed to delete the code']);    
        }
        return new UpdateCodeResultDto(0, false, ['not allowed to delete the code']);
    }

    async deleteCode(loginId: number, deleteCodeDto: DeleteCodeDto):Promise<DeleteCodeResultDto> {
        let adminYn = (await this.userRepository.findOneBy({id: loginId})).adminYn
        if(adminYn == "Y") {
            let foundCode = await this.codeRepository.findOne({where: {code: deleteCodeDto.code, codeGroup: deleteCodeDto.codeGroup}})
            if(foundCode == null) {
                return new DeleteCodeResultDto(0, false, ['failed to find the code']);
            }
            let rslt = await this.codeRepository.delete({codeGroup: deleteCodeDto.codeGroup, code: deleteCodeDto.code});
            if(rslt.affected > 0) {
                Logger.debug(`code 삭제 : ${deleteCodeDto.code}`);
                return new DeleteCodeResultDto(rslt.affected);
            }
            return new DeleteCodeResultDto(0, false, ['failed to delete the code']);    
        }
        return new DeleteCodeResultDto(0, false, ['not allowed to delete the code']);
    }
    
}

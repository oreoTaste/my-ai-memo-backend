import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';
import { InsertUserDto, InsertUserResultDto, LoginUserDto, LoginUserResultDto, SearchUserDto, SearchUserResultDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * @description 회원가입
   */
  async insertUser(insertUserDto: InsertUserDto):Promise<InsertUserResultDto> {
    try {
      // 해당 ID로 가입이 이미 된 경우 : 실패처리
      let foundUser = await this.usersRepository.findOne({where: {loginId: insertUserDto.loginId}, select: ['id', 'isActive', 'name', 'createdAt'], comment: "UserService.insertUser"});
      if(foundUser) {
        return new InsertUserResultDto(null, false, ['already registered']);
      }

      // 가입처리
      let user = await this.usersRepository.save({
        ...insertUserDto, isActive: true, insertId: 1, updateId: 1
      });
      return new InsertUserResultDto(user);
    } catch(e) {
      return new InsertUserResultDto(null, false, ['failed to insert User']);
    }
  }

  /**
   * @description 로그인
   */
  async login(loginUserDto: LoginUserDto): Promise<LoginUserResultDto> {
    let user = (await this.usersRepository.findOne({where: loginUserDto, select: ['id', 'loginId', 'isActive', 'name', 'createdAt', 'adminYn'], comment: "UserService.login"}));
    if(user) {
      return new LoginUserResultDto(user);
    }
    return new LoginUserResultDto(null, false, ['failed to login']);
  }

  /**
   * @description 회원 검색
   */
  async searchUser(searchUserDto: SearchUserDto): Promise<SearchUserResultDto> {
    const {loginId, name} = searchUserDto;
    if(!loginId && !name) {
      throw new Error("no parameters");
    }
    let users = (await this.usersRepository.find({where: {loginId, name}, select: ['id', 'isActive', 'name', 'createdAt'], order: {id: "ASC"}, take: 100, comment: "UserService.searchUser"}));
    if(users.length == 0) {
      return new SearchUserResultDto(null, false, ['found no user']);
    }
    return new SearchUserResultDto(users);
  }

  /**
   * @description 전체 회원 목록 조회
   */
  async retreiveUserBySeq(seq: number): Promise<User> {
    return await this.usersRepository.findOne({where: {id: seq}, comment: "UserService.retreiveUserBySeq"});
  }

  /**
   * @description 전체 회원 목록 조회
   */
  async listUser(idInsert: number): Promise<User[]> {
    return await this.usersRepository.find({order: {id: "ASC"}, take: 100, comment: "UserService.listUser"});
  }

}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entity/user.entity';
import { InsertUserDto, InsertUserResultDto, LoginUserDto, ModifyUserDto, SearchUserDto } from './dto/user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  /**
   * @description 회원가입
   */
  async insertUser(insertUserDto: InsertUserDto): Promise<InsertUserResultDto> {
    try {
      // 해당 ID로 가입이 이미 된 경우 : 실패처리
      let foundUser = await this.usersRepository.findOne({
        where: { loginId: insertUserDto.loginId },
        select: ['id', 'isActive', 'name', 'createdAt'],
        comment: 'UserService.insertUser',
      });
      if (foundUser) {
        return new InsertUserResultDto(null, false, ['already registered']);
      }

      // 가입처리
      let user = await this.usersRepository.save({
        ...insertUserDto,
        isActive: true,
        insertId: 1,
        updateId: 1,
      });
      return new InsertUserResultDto(user);
    } catch (e) {
      return new InsertUserResultDto(null, false, ['failed to insert User']);
    }
  }

  /**
   * @description 로그인
   */
  async login({ loginId }: LoginUserDto): Promise<User> {
    return await this.usersRepository.findOne({
      where: { loginId, isActive: true },
      select: [
        'id',
        'loginId',
        'isActive',
        'name',
        'createdAt',
        'adminYn',
        'password',
      ],
      comment: 'UserService.login',
    });
  }

  /**
   * @description 회원 검색
   */
  async searchUser(searchUserDto: SearchUserDto): Promise<User[]> {
    const { loginId, name } = searchUserDto;
    if (!loginId || !name) {
      throw new Error('no parameters');
    }
    return await this.usersRepository.find({
      where: { loginId, name, isActive: true },
      select: ['id', 'loginId', 'name', 'createdAt'],
      comment: 'UserService.searchUser',
    });
  }

  /**
   * @description 전체 회원 목록 조회
   */
  async retreiveUserBySeq(seq: number): Promise<User> {
    return await this.usersRepository.findOne({
      where: { id: seq },
      comment: 'UserService.retreiveUserBySeq',
    });
  }

  /**
   * @description 회원 조회
   */
  async getProfile(loginId: string): Promise<User> {
    return await this.usersRepository.findOne({where: {loginId}});
  }

  /**
   * @description 회원 정보 변경
   */
  async modifyProfile({id, loginId, currentPassword, newPassword, name, telegramId}: ModifyUserDto): Promise<User> {
    try {
      // 체크1. ID가 존재하는지 확인
      let user = await this.usersRepository.findOne({
        where: { id },
        comment: "UserService.modifyProfile#findUserById"
      });
      if (!user) {
        throw new Error(`ID ${id}에 해당하는 사용자를 찾을 수 없습니다.`);
      }

      // 체크2. 로그인 여부 확인
      if(currentPassword) {
        let succeedToLogin = await bcrypt.compare(currentPassword, user.password);
        if(!succeedToLogin) {
          throw new Error(`비밀번호 오류`);
        }  
      }

      // 체크3. loginId가 변경된 경우, 신규 loginId가 존재하는지 확인
      if(user.loginId !== loginId) {
        user = await this.usersRepository.findOne({
          where: { loginId },
          comment: "UserService.modifyProfile#findUserByLoginId"
        });
        if (user) {
          throw new Error(`입력한 로그인id에 해당하는 고객이 이미 존재합니다`);
        }
      }


      // 업데이트 수행
      let updateProfile = { loginId, name, telegramId } as User;
      if(newPassword) {
        updateProfile.password = newPassword;
      }
      
      const updateResult = await this.usersRepository.update(
        { id },
        updateProfile
      );

      if (updateResult.affected === 0) {
        throw new Error("회원 정보 업데이트에 실패했습니다.");
      }

      // 업데이트된 최신 사용자 정보 반환
      const updatedUser = await this.usersRepository.findOne({
        where: { id },
        comment: "UserService.modifyProfile#findUserById"
      });

      return updatedUser;
    } catch (error) {
      Logger.error("회원 정보 수정 중 오류 발생:", error.message);
      throw error;
    }
  }

  /**
   * @description 로그인아이디 가능여부 확인
   * @returns 존재여부 (true: 존재, false: 부재)
   */
  async checkExistLoginId(loginId: string): Promise<boolean> {
    try {
      // ID가 존재하는지 확인
      let foundUser = await this.usersRepository.findOne({
        where: { loginId, isActive: true },
      });
      if(!foundUser) {
        return false;
      }
      return true;
    } catch(e) {
      return false;
    }
  }
}

import { Body, Controller, Get, Post, Query, Session } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthUser } from 'src/common/decorator/custom-decorator';
import { AuthUserDto, InsertUserDto, InsertUserResultDto, ListUserResultDto, LoginUserDto, LoginUserResultDto, SearchUserDto, SearchUserResultDto } from './dto/user.dto';
import { CommonResultDto } from 'src/common/dto/common.dto';
import * as bcrypt from 'bcrypt';
const saltOrRounds = 10;

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * @description 세션체크
   */
  @Post('auth')
  async authUser(@AuthUser() authUser: AuthUserDto): Promise<CommonResultDto>{
    if(authUser.id) {
      return new CommonResultDto(true, ['success']);
    }
    return new CommonResultDto(false, ['failed to authorize']);
  }


  /**
   * @description 회원가입
   */
  @Post('sign-in')
  async signIn(@Body() insertUserDto: InsertUserDto): Promise<InsertUserResultDto> {
    insertUserDto.password = await bcrypt.hash(insertUserDto.password, saltOrRounds);
    return await this.userService.insertUser(insertUserDto);
  } 

  /**
   * @description 로그인
   */
  @Post('login')
  async loginUser(@Body() loginUserDto: LoginUserDto
                , @Session() session: Record<string, any>
                , @AuthUser() authUser: AuthUserDto): Promise<LoginUserResultDto>{
    let foundUser = await this.userService.login(loginUserDto);
    if(!foundUser) {
      // 회원 찾기 실패 (loginId)
      return new LoginUserResultDto(null, false, ['failed to find user']);
    }
  
    let succeedToLogin = await bcrypt.compare(loginUserDto.password, foundUser.password);  
    if (!succeedToLogin) {
      // 회원 찾기 실패 (password)
      return new LoginUserResultDto(null, false, ['failed to find user']);
    }

    session['user'] = foundUser;
    return new LoginUserResultDto(foundUser);
  }

  /**
   * @description 회원 검색
   */
  @Get('search')
  async searchUser(@Query() searchUserDto: SearchUserDto
                 , @AuthUser() authUser: AuthUserDto): Promise<SearchUserResultDto> {
    if(authUser) {
      try {
        let searchedUsers = await this.userService.searchUser(searchUserDto);
        return new SearchUserResultDto(searchedUsers);
      } catch (error) {
        const errorMessage = String(error).split('\n')[0].replace('Error: ', "");
        return new SearchUserResultDto(null, false, [errorMessage]);
      }
    }
    return new SearchUserResultDto(null, false, ['error while searching the user']);
  }

    /**
   * @description 회원 목록 조회
   */
    @Get('list')
    async listUser(@AuthUser() authUser: AuthUserDto): Promise<ListUserResultDto> {
      if(authUser) {
        try {
          return new ListUserResultDto(await this.userService.listUser(authUser.id));
        } catch (error) {
          const errorMessage = String(error).split('\n')[0].replace('Error: ', "");
          return new ListUserResultDto(null, false, [errorMessage]);
        }
      }
      return new ListUserResultDto(null, false, ['error while searching the user']);
    }
  
}

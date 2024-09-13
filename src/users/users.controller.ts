import { Controller, Body, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { HttpMethodEnum, Route } from '@libs/core/decorators';
import { ApiTags } from '@nestjs/swagger';
import { PhoneAuthInfo, UserInfo } from '@libs/core/decorators/info.decorator';
import {
  PhoneTokenPayload,
  TokenPayload,
} from 'src/passport/interfaces/passport.interface';
import { PostRO } from 'src/posts/dto/post.ro';
import { PhoneAuthGuard } from 'src/passport/strategies/phone.strategy';
import {
  CreateAndUpdateMbtiDTO,
  CreateAndUpdateNicknameDTO,
  UpdateMbtiDTO,
} from './dto/user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // @Route({
  //   path: '/setting',
  //   method: 'post',
  //   auth: true,
  //   summary: '약관 동의에 대한 여부 -> 추후에 없어질 예정',
  // })
  // updateSettings(@Param('id') id: string, @Body() settingsDto: any) {
  //   return this.usersService.updateSettings(+id, settingsDto);
  // }

  @Route({
    path: 'nickname/unique',
    method: HttpMethodEnum.GET,
    summary: '닉네임 중복 검사 ',
  })
  async checkNicknameUnique(@Body() dto: CreateAndUpdateNicknameDTO) {
    const { nickname } = dto;
    return this.usersService.isNicknameUnique(nickname);
  }

  @Route({
    path: '/nickname',
    method: HttpMethodEnum.POST,
    guards: [PhoneAuthGuard],
    auth: true,
    summary: '최초 닉네임 설정',
  })
  async createNickname(
    @Body() dto: CreateAndUpdateNicknameDTO,
    @PhoneAuthInfo() phoneAuth: PhoneTokenPayload,
  ) {
    const { nickname } = dto;
    return await this.usersService.createNickname(nickname, phoneAuth);
  }

  @Route({
    path: '/nickname',
    method: 'patch',
    auth: true,
    summary: '닉네임 변경',
  })
  updateNickname(
    @UserInfo() user: TokenPayload,
    @Body() dto: CreateAndUpdateNicknameDTO,
  ) {
    const { id } = user;
    const { nickname } = dto;
    return this.usersService.updateNickname(+id, nickname);
  }

  @Route({
    path: '/mbti/:type',
    method: HttpMethodEnum.GET,
    summary: '유저가 선택한 MBTI에 대한 정보 가져오기',
  })
  async getMbtiInfo(@Param('type') type: string) {
    return await this.usersService.getMbtiInfo(type);
  }

  @Route({
    path: '/mbti',
    auth: true,
    guards: [PhoneAuthGuard],
    method: HttpMethodEnum.POST,
    summary: '첫번째 MBTI 설정',
  })
  async postMbti(
    @PhoneAuthInfo() phoneAuth: PhoneTokenPayload,
    @Body() dto: CreateAndUpdateMbtiDTO,
  ) {
    const { mbti } = dto;

    return await this.usersService.postMbti(phoneAuth, mbti);
  }

  @Route({
    path: '/mbti',
    method: 'patch',
    auth: true,
    summary: 'MBTI 변경',
  })
  updateMbti(@UserInfo() user: TokenPayload, @Body() dto: UpdateMbtiDTO) {
    const { id } = user;
    const { mbti } = dto;
    return this.usersService.updateMbti(+id, mbti);
  }

  @Route({
    path: '/posts',
    method: 'get',
    auth: true,
    summary: '내가 작성한 글 가져오기',
    transform: PostRO,
  })
  getUserPosts(@UserInfo() user: TokenPayload) {
    const { id } = user;
    return this.usersService.getUserPosts(+id);
  }
  @Route({
    path: '/:id',
    method: HttpMethodEnum.GET,
    auth: true,
    summary: '유저 정보 가져오기',
    transform: PostRO,
  })
  getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(+id);
  }

  @Route({
    path: '/',
    method: 'get',
    auth: true,
    summary: '나의 개인정보 가져오기',
  })
  getMyInfo(@UserInfo() user: TokenPayload) {
    return user;
  }
}

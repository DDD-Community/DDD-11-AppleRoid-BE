import { Body, Controller } from '@nestjs/common';
import { PassportService } from './passport.service';
import { ApiTags } from '@nestjs/swagger';
import { HttpMethodEnum, Route } from '@libs/core/decorators';
import {
  PassportPhoneAuthDTO,
  RefreshTokenDto,
  VerifyPhoneAuthRandomNumberDTO,
} from './dto/passport.dto';
import { RefreshTokenGuard } from './strategies/refresh.jwt.strategy';
import { PhoneAuthRO } from './dto/passport.ro';

@ApiTags('passport-auth')
@Controller('passport')
export class PassportController {
  constructor(private readonly passportService: PassportService) {}

  @Route({
    path: '/request/phone/auth',
    method: 'POST',
    summary: '전화번호 인증 요청하기',
    description: '인증 번호를 생성하고 저장합니다.',
  })
  async requestPhoneAuth(@Body() dto: PassportPhoneAuthDTO) {
    const { phoneNumber } = dto;
    const verificationCode =
      await this.passportService.sendRandomNumber(phoneNumber);
    return `인증 번호 ${verificationCode} 가 발송되었습니다.`;
  }

  @Route({
    path: '/verify/phone/auth',
    method: 'POST',
    summary: '전화번호 인증 검증하기',
    transactional: true,
    description: '인증 번호를 검증하고 성공 시 verifiedAt을 업데이트합니다.',
    transform: PhoneAuthRO,
  })
  async verifyPhoneAuth(
    @Body() dto: VerifyPhoneAuthRandomNumberDTO,
  ): Promise<PhoneAuthRO> {
    const { phoneNumber, verificationCode } = dto;
    const phoneTokenPayload = await this.passportService.verifyRandomNumber(
      phoneNumber,
      verificationCode,
    );
    return {
      message: '전화번호 인증이 완료되었습니다.',
      accessToken: phoneTokenPayload,
    };
  }

  @Route({
    path: '/sign-in/phone',
    method: HttpMethodEnum.POST,
    summary: '전화번호로 로그인',
    description: '전화번호로 로그인',
  })
  async signIn(@Body() signInDto: VerifyPhoneAuthRandomNumberDTO) {
    return await this.passportService.signInByPhone(signInDto);
  }

  // @Route({
  //   path: '/sign-up',
  //   method: HttpMethodEnum.POST,
  //   transactional: true,
  //   summary: '회원가입',
  //   description: '이후에 핸드폰 인증하는 작업 추가될 예정',
  // })
  // async singUp(@Body() createPassportDto: CreatePassportDto) {
  //   console.log(createPassportDto);
  //   return await this.passportService.singUp(createPassportDto);
  // }

  // @Route({
  //   path: '/sign-in',
  //   method: HttpMethodEnum.POST,
  //   summary: '로그인',
  //   description: '이후에 핸드폰 인증하는 작업 추가될 예정',
  // })
  // async signInByPhoneNumber(@Body() signInDto: SignInDto) {
  //   return await this.passportService.signIn(signInDto);
  // }

  @Route({
    path: '/refresh',
    method: HttpMethodEnum.POST,
    guards: [RefreshTokenGuard],
    summary: '리프레시 토큰 검증 ',
    description: '이후에 핸드폰 인증하는 작업 추가될 예정',
  })
  async refresh(@Body() refreshToken: RefreshTokenDto) {
    return refreshToken;
  }
}

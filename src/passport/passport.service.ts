import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AbstractRepository } from '@libs/core/databases';
import { PassportAuth } from '@libs/core/databases/entities/passport.auth.entity';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  CreatePassportDto,
  SignInDto,
  VerifyPhoneAuthRandomNumberDTO,
  RefreshTokenDto,
} from './dto/passport.dto';
import { CommonError, ERROR } from '@libs/core/types';
import {
  PhoneTokenPayload,
  TokenPayload,
} from './interfaces/passport.interface';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PassportProviderType } from './interfaces/passport.type';
import * as bcrypt from 'bcryptjs';
@Injectable()
export class PassportService extends AbstractRepository<PassportAuth> {
  private generateToken(
    payload: TokenPayload | PhoneTokenPayload,
    tokenSecret: string,
    tokenExpired: string,
  ): string {
    return this.jwtService.sign(payload, {
      secret: tokenSecret,
      expiresIn: tokenExpired,
    });
  }
  constructor(
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
    @InjectRepository(PassportAuth)
    private readonly passportAuthRepository: Repository<PassportAuth>,
    @Inject(REQUEST) private readonly req: Request,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    super(passportAuthRepository, req);
  }
  async getPassportAuthByPhone(phoneNumber: string) {
    console.log('phoneNumber : ', phoneNumber);
    const passportAuth = await this.passportAuthRepository.findOne({
      where: {
        phoneNumber,
      },
    });
    return passportAuth;
  }

  /* 해당 유저가 정상적인 유저입지 검사 */
  /**
   * @deprecated
   * **/
  async validateUser(email: string, password: string): Promise<any> {
    return test;
    // const user = await this.findOne({
    //   where: {
    //     email,
    //   },
    // });

    // if (user && (await bcrypt.compare(password, user.password))) {
    //   const { ...result } = user;
    //   return result;
    // }
    // return null;
  }

  /**
   * @deprecated
   */
  async singUp(createPassportDto: CreatePassportDto) {
    const user = await this.passportAuthRepository.findOne({
      where: {
        email: createPassportDto.email,
      },
    });
    if (user) {
      throw new CommonError({
        error: ERROR.ALREADY_USED_DATA,
        message: '이미 사용중인 계정 정보입니다. ',
      });
    }
    // 비밀번호 암호화
    const salt = await bcrypt.genSalt();
    createPassportDto.password = await bcrypt.hash(
      createPassportDto.password,
      salt,
    );

    const passportAuthEntity =
      this.passportAuthRepository.create(createPassportDto);

    const passportAuth =
      await this.passportAuthRepository.save(passportAuthEntity);

    const userEntity = {
      passportAuthId: passportAuth.id,
    };

    await this.usersService.createUserPassportAuth(userEntity);

    return passportAuth;
  }

  /**
   * @deprecated
   */
  async signIn(signInDto: SignInDto) {
    const user = await this.validateUser(signInDto.email, signInDto.password);
    if (!user) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_USER,
      });
    }
    const tokenPayload: any = {
      id: user.id,
      // username: user.username,
      nickname: user.nickname,
    };

    const accessToken = this.generateToken(
      tokenPayload,
      this.configService.get('JWT_ACCESS_SECRET'),
      this.configService.get('JWT_ACCESS_EXPIRED'),
    );
    const refreshToken = this.generateToken(
      tokenPayload,
      this.configService.get('JWT_REFRESH_SECRET'),
      this.configService.get('JWT_REFRESH_EXPIRED'),
    );

    // TODO : refresh token 저장
    await this.passportAuthRepository.update(user.id, {
      refresh_token: refreshToken,
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async sendRandomNumber(phoneNumber: string): Promise<string> {
    const verificationCode = this.generateRandomNumber();

    const verificationExpires = new Date(Date.now() + 5 * 60 * 1000); // 5분 후 만료

    // 랜덤 번호 암호화
    const hashedVerificationCode = await bcrypt.hash(verificationCode, 10);

    const passport = await this.findOne({
      where: {
        phoneNumber,
      },
    });

    // todo 인증 완료된 회원의 경우 어떤 플로우인지에 따라서 변경 가능성 O
    // if (passport && passport.verifiedAt !== null) {
    //   throw new CommonError({
    //     error: ERROR.INVALID_REQUEST,
    //     message: '이미 인증이 완료된 전화번호입니다. 로그인을 진행해주세요',
    //   });
    // }

    await this.upsert({
      id: passport?.id,
      phoneNumber,
      provider: PassportProviderType.PHONE,
      verificationCode: hashedVerificationCode,
      verificationExpires,
    });

    // TODO: 실제 SMS 발송 로직 구현
    console.log(`Verification code를 발송한 것을 추후에 보내야 한다.`);
    return verificationCode;
  }

  async verifyRandomNumber(phoneNumber: string, code: string): Promise<string> {
    const passportAuth = await this.passportAuthRepository.findOne({
      where: { phoneNumber },
    });

    if (!passportAuth) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_DATA,
        message: '해당 전화번호로 등록된 사용자가 없습니다.',
      });
    }

    if (passportAuth.verificationExpires < new Date()) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_DATA,
        message: '이미 만료된 인증 코드입니다.',
      });
    }

    // 암호화된 코드와 입력된 코드 비교
    const isValidCode = await bcrypt.compare(
      code,
      passportAuth.verificationCode,
    );

    if (!isValidCode) {
      throw new CommonError({
        error: ERROR.INVALID_REQUEST,
        message: '잘못된 인증 코드입니다.',
      });
    }

    // 인증 성공 시 verifiedAt 업데이트
    await this.passportAuthRepository.update(
      { id: passportAuth.id },
      {
        verifiedAt: new Date(),
        verificationCode: null,
        verificationExpires: null,
      },
    );

    const tokenPayload: PhoneTokenPayload = {
      passportAuthId: passportAuth.id,
      phoneNumber,
    };

    const accessToken = this.generateToken(
      tokenPayload,
      this.configService.get('JWT_PHONE_SECRET'),
      this.configService.get('JWT_PHONE_EXPIRED'),
    );

    const user = await this.usersService.findOne({
      where: {
        passportAuthId: passportAuth.id,
      },
    });

    await this.usersService.upsert({
      id: user?.id,
      passportAuthId: passportAuth.id,
    });
    return accessToken;
  }

  // 전화번호로 로그인했을 때 담기는 token정보를 추가함
  async signInByPhone(signInDto: VerifyPhoneAuthRandomNumberDTO) {
    const accessToken = await this.verifyRandomNumber(
      signInDto.phoneNumber,
      signInDto.verificationCode,
    );

    const phoneTokenPayload = this.jwtService.verify(accessToken, {
      secret: this.configService.get('JWT_PHONE_SECRET'),
    }) as PhoneTokenPayload;

    const { passportAuthId } = phoneTokenPayload;

    const user = await this.usersService.findOne({
      where: {
        passportAuthId,
      },
    });

    const tokenPayload: TokenPayload = {
      id: user.id,
      passportAuthId,
    };
    const newAccessToken = this.generateToken(
      tokenPayload,
      this.configService.get('JWT_PHONE_SECRET'),
      this.configService.get('JWT_PHONE_EXPIRED'),
    );

    return newAccessToken;

    // 전화번호로 로그인한 이후에는 유저의 정보를 함께 주어야 한다.
  }

  async softDelete(passportAuthId: number) {
    return await this.passportAuthRepository.softDelete({
      id: passportAuthId,
    });
  }

  private generateRandomNumber(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

import {
  applyDecorators,
  CanActivate,
  Delete,
  Get,
  Patch,
  Post,
  Put,
  Redirect,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { DeserializeInterceptor } from '../interceptors/deserialize.interceptor';
import { TimeoutInterceptor } from '../interceptors';
import { TransactionInterceptor } from '../interceptors/transaction.interceptor';
import { JwtAuthGuard } from 'src/passport/strategies/jwt.strategy';
import { IAuthGuard, Type } from '@nestjs/passport';
import { PhoneAuthGuard } from 'src/passport/strategies/phone.strategy';

const getEnumKeyByValue = (_enum: any, _value: any) => {
  const indexOfS = Object.values(_enum).indexOf(_value as unknown);

  const key = Object.keys(_enum)[indexOfS];
  return key || _value;
};

export enum HttpMethodEnum {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH',
  ALL = 'ALL',
  OPTIONS = 'OPTIONS',
  HEAD = 'HEAD',
}

export const Tags = ApiTags;

export interface RouteOptions {
  path?: string; // 경로
  method: HttpMethodEnum | string; // HTTP 메소드
  summary?: string; // 요약
  description?: string; // 설명
  tags?: string[]; // 태그 배열
  guards?: Type<IAuthGuard | CanActivate>[];
  redirect?: boolean; // 리다이렉트 여부
  exclude?: boolean; // 엔드포인트 제외 여부
  auth?: boolean; // 인증 필요 여부
  timeout?: number; // 타임아웃 처리 (설정을 안하면 120000 = 120초)
  transform?: any;
  transactional?: boolean; // transaction 처리 여부
}

export function Route(options: RouteOptions) {
  const defaultContentType = 'application/json';

  const method = getEnumKeyByValue(
    HttpMethodEnum,
    options.method,
  ).toUpperCase();
  const decorators = [];

  if (!options.path) {
    throw new Error('UNKNOWN PATH');
  }

  // Method (required)
  if (method === HttpMethodEnum.GET) {
    decorators.push(Get(options.path));
  } else if (method === HttpMethodEnum.POST) {
    decorators.push(Post(options.path));
  } else if (method === HttpMethodEnum.PUT) {
    decorators.push(Put(options.path));
  } else if (method === HttpMethodEnum.PATCH) {
    decorators.push(Patch(options.path));
  } else if (method === HttpMethodEnum.DELETE) {
    decorators.push(Delete(options.path));
  } else {
    throw new Error('UNKNOWN METHOD');
  }

  decorators.push(Allow);

  // Summary
  if (options.summary || options.description) {
    decorators.push(
      ApiOperation({
        summary: options.summary,
        description: options.description,
      }),
    );
  }

  // Tags
  if (options.tags) {
    options.tags.forEach((tag) => {
      decorators.push(ApiTags(tag));
    });
  }

  // Auth
  if (options.auth === true) {
    options.guards = options.guards || [];

    if (options.guards.includes(PhoneAuthGuard)) {
      options.guards.unshift(PhoneAuthGuard);
    } else {
      options.guards.unshift(JwtAuthGuard);
    }

    decorators.push(ApiBearerAuth());

    decorators.push(
      ApiResponse({
        status: 401,
        description: 'Unauthorized',
        content: {
          [defaultContentType]: {
            example: {
              UnAuthorized: {
                status: 'ERROR',
                statusCode: 401,
                message: 'Unauthorized',
              },
            },
          },
        },
      }),
    );

    decorators.push(
      ApiResponse({
        status: 403,
        description: 'Access Not Allow',
        content: {
          [defaultContentType]: {
            example: {
              AccessNotAllow: {
                status: 'ERROR',
                message: 'Access Not Allow',
                statusCode: 403,
              },
            },
          },
        },
      }),
    );
  }

  if (options.guards && options.guards.length > 0) {
    decorators.push(UseGuards(...options.guards));
  }

  decorators.push(ApiConsumes('application/x-www-form-urlencoded'));
  decorators.push(ApiConsumes('application/json'));

  // Redirect
  if (options.redirect) {
    decorators.push(Redirect());
    decorators.push(ApiResponse({ status: 302, description: 'Redirect' }));
  } else {
    if (['POST', 'PUT'].includes(method)) {
      decorators.push(ApiResponse({ status: 201, description: 'Success' }));
    } else {
      decorators.push(ApiResponse({ status: 200, description: 'Success' }));
    }
    decorators.push(ApiResponse({ status: 500, description: 'Error' }));
  }

  // Exclude
  if (options.exclude) {
    decorators.push(ApiExcludeEndpoint());
  }

  // Timeout
  if (options.timeout > 0) {
    decorators.push(UseInterceptors(new TimeoutInterceptor(options.timeout)));
  }

  // Deserialize
  if (options.transform) {
    decorators.push(
      UseInterceptors(new DeserializeInterceptor(options.transform)),
    );
    // Add Swagger response schema for successful operations
    decorators.push(
      ApiResponse({
        status: ['POST', 'PUT'].includes(method) ? 201 : 200,
        description: 'Success',
        type: options.transform,
      }),
    );
  }

  // transactional
  if (options.transactional) {
    console.log('tranasactional interceptor 사용');
    decorators.push(UseInterceptors(TransactionInterceptor));
  }

  // decorators.push(UseFilters(HttpExceptionFilter));

  return applyDecorators(...decorators);
}

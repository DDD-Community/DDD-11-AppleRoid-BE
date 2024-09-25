import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '첫 ECS CI/CD with RDS 구축';
  }
}

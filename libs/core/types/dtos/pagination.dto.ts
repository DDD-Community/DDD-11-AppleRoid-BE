import { Property } from 'libs/core/decorators';
import { OrderType } from '../interfaces';

export class PaginationDto<T> {
  @Property({
    description: '페이지 번호',
    type: 'number',
    default: 1,
    required: true,
  })
  page: number = 1;

  @Property({
    description: '페이지 당 항목 수',
    type: 'number',
    default: 20,
    required: true,
  })
  limit: number = 20;

  @Property({
    description: '정렬 기준 필드',
    type: 'string',
    default: 'id',
    required: false,
  })
  sortBy?: keyof T;

  @Property({
    enum: OrderType,
    description: '정렬 순서 (오름차순/내림차순)',
    type: 'string',
    default: OrderType.DESC,
    required: false,
  })
  sortDesc?: OrderType;

  get skip() {
    return (this.page - 1) * this.limit;
  }

  get take() {
    return this.limit;
  }
}

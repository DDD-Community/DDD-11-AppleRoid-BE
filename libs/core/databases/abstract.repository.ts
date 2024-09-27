import {
  DeepPartial,
  DeleteResult,
  EntityManager,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  FindOptionsWhereProperty,
  InsertResult,
  ObjectLiteral,
  Repository,
  UpdateResult,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CommonError, ERROR, OrderType, Pagination } from '../types';
import { PaginationDto } from '../types/dtos/pagination.dto';
import { MyLogger } from '../helpers/logger.helper';
import { AbstractEntity } from './abstract.entity';
import { Request } from 'express';
import { ENTITY_MANAGER_KEY } from '../interceptors/transaction.interceptor';

export declare type FindAllOptions<Entity = any> = {
  [P in keyof Entity]?: P extends 'toString'
    ? unknown
    : FindOptionsWhereProperty<NonNullable<Entity[P]>>; //Entity[P]는 Entity 객체에서 키 P에 해당하는 속성의 타입을 의미
} & PaginationDto<Entity> & {
    select?: (keyof Entity)[];
    where?:
      | FindOptionsWhere<Entity>[]
      | FindOptionsWhere<Entity>
      | ObjectLiteral
      | any;
    relations?: string[];
    loadRelationIds?:
      | boolean
      | {
          relations?: string[];
          disableMixedMap?: boolean;
        };
    loadEagerRelations?: boolean;
  };

type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export class AbstractRepository<TEntity extends AbstractEntity> {
  protected readonly logger = new MyLogger(this.constructor.name);

  constructor(
    protected readonly repository: Repository<TEntity>,
    private request: Request,
  ) {}

  getRepository(): Repository<TEntity> {
    const entityManager: EntityManager = this.request[ENTITY_MANAGER_KEY];

    return (
      entityManager?.getRepository(this.repository.target) ?? this.repository
    );
  }

  async upsert(entity: DeepPartial<TEntity>): Promise<TEntity> {
    const repository = this.getRepository();

    // const id: TEntity = await repository.findOne({
    //   where: {
    //     id: entity.id,
    //   },
    // });
    // if (id) {
    //   throw new ConflictException(ERROR.ALREADY_USED_DATA);
    // }

    const item = repository.create(entity);

    return await repository.save(item);
  }

  // async createMany(
  //   entities: (DeepPartial<TEntity> & TEntity)[],
  // ): Promise<TEntity[]> {
  //   const repository: Repository<TEntity> = this.getRepository();
  //   return await repository.save(entities);
  // }

  async insert(
    entity: QueryDeepPartialEntity<TEntity> | QueryDeepPartialEntity<TEntity>[],
  ): Promise<InsertResult> {
    return await this.getRepository().insert(entity);
  }

  // async upsert(entity: DeepPartial<TEntity>): Promise<TEntity> {
  //   return await this.getRepository().save(entity);
  // }

  async findAll(
    options: FindAllOptions<TEntity> | any,
  ): Promise<Pagination<TEntity>> {
    const filter: FindManyOptions<TEntity> = Object.assign({
      ...options,
      skip: options.skip,
      take: options.take,
    });

    if (!options.relations) {
      Object.assign(filter, {
        loadRelationIds: {
          disableMixedMap: true,
        },
      });
    }

    if (options.sortBy) {
      const order = {};
      order[options.sortBy] = options.sortDesc
        ? options.sortDesc
        : OrderType.DESC;
      filter.order = order;
    }

    return new Pagination({
      results: await this.getRepository().find(filter),
      total: await this.getRepository().count(filter),
      page: options.page,
      skip: filter.skip,
      take: filter.take,
    });
  }

  async findById(
    id: number,
    option: FindOneOptions<TEntity> = {},
  ): Promise<TEntity | undefined> {
    if (!option?.relations) {
      Object.assign(option, {
        loadRelationIds: {
          disableMixedMap: true,
        },
      });
    }
    return await this.getById(id, option);
  }

  async findOne(options: FindOneOptions<TEntity> = {}): Promise<TEntity> {
    if (!options?.relations) {
      Object.assign(options, {
        loadRelationIds: {
          disableMixedMap: true,
        },
      });
    }
    return await this.getRepository().findOne(options);
  }

  async findOneThrowException(
    options: FindOneOptions<TEntity> = {},
  ): Promise<TEntity> {
    if (!options?.relations) {
      Object.assign(options, {
        loadRelationIds: {
          disableMixedMap: true,
        },
      });
    }

    const entity = await this.getRepository().findOne(options);
    if (!entity) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_DATA,
        message: `${this.getRepository.name}에 해당하는 데이터가 존재하지 않습니다.`,
      });
    }

    return entity;
  }

  // pk를 바탕으로 업데이트 하기
  async updateById(
    id: number,
    entity: QueryDeepPartialEntity<TEntity>,
  ): Promise<TEntity> {
    const where: any = { id: id };

    await this.getRepository().update(id, entity);
    return await this.getRepository().findOne({ where });
  }

  async removeById(
    id: number,
    option?: { hardDelete?: boolean },
  ): Promise<UpdateResult | DeleteResult> {
    await this.getById(id);
    if (option?.hardDelete) {
      return await this.getRepository().delete(id);
    } else {
      return await this.getRepository().softDelete(id);
    }
  }

  async remove(
    where: RequireAtLeastOne<TEntity | { [key: string]: number }>,
    option?: { hardDelete?: boolean },
  ): Promise<UpdateResult | DeleteResult> {
    if (!where || !Object.keys(where)?.length) {
      throw new CommonError({ error: ERROR.NOT_ALLOWED_REMOVE_ALL });
    }
    if (option?.hardDelete) {
      return await this.getRepository().delete(where as FindOptionsWhere<any>);
    } else {
      return await this.getRepository().softDelete(
        where as FindOptionsWhere<any>,
      );
    }
  }

  async getById(
    id: number,
    option?: FindOneOptions<TEntity>,
  ): Promise<TEntity> {
    if (typeof id === 'undefined' || id === null) {
      throw new CommonError({
        error: ERROR.INVALID_PARAMS,
        message: `id가 존재하지 않습니다.`,
      });
    }

    const where: any = { id: id };
    const model: TEntity = await this.getRepository().findOne({
      where: { ...where, ...option?.where },
      ...option,
    });
    if (!model) {
      throw new CommonError({
        error: ERROR.NO_EXISTS_DATA,
        message: `${this.getRepository.name}에 해당하는 데이터가 존재하지 않습니다.`,
      });
    }
    return model;
  }

  async findMany(options?: FindManyOptions<TEntity>): Promise<TEntity[]> {
    return await this.getRepository().find(options);
  }

  async getMany({
    select,
    where,
    order,
    skip,
    take,
  }: {
    select?: string[];
    where?: string;
    order?: {
      [columnName: string]:
        | OrderType.ASC
        | OrderType.DESC
        | {
            order: OrderType.ASC | OrderType.DESC;
            nulls?: 'NULLS FIRST' | 'NULLS LAST';
          };
    };
    skip?: number;
    take?: number;
  }): Promise<TEntity[]> {
    const query = this.getRepository().createQueryBuilder('a');

    if (select) {
      query.select(select);
    }

    if (where) {
      query.where(where);
    }

    if (order) {
      query.orderBy(order);
    }

    if (skip && take) {
      query.limit(take).offset(skip);
    }

    return await query.getMany();
  }
}

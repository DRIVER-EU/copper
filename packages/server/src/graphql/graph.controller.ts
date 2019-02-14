import { GqlOptionsFactory, GqlModuleOptions } from '@nestjs/graphql';
import { buildSchema } from 'type-graphql';
import { Injectable } from '@nestjs/common';

@Injectable()
export class GraphqlConfigService implements GqlOptionsFactory {
  async createGqlOptions(): Promise<GqlModuleOptions> {
    const schema = await buildSchema({
      resolvers: [__dirname + '../**/*.resolver.ts'],
    });

    return {
      debug: true,
      playground: true,
      schema,
    };
  }
}
import { ObjectType, Field, ID, Resolver, Query } from "type-graphql";

@ObjectType()
class Recipe {
  @Field()
  id: string;

  @Field()
  title: string;
}

@Resolver(Recipe)
class RecipeResolver {
//   constructor(
//     private recipeService: RecipeService,
//   ) {}

  @Query(returns => [Recipe])
  recipes() {
    return [{ id: 'test', title: 'test'}]
  }

//   @Mutation()
//   @Authorized(Roles.Admin)
//   removeRecipe(@Arg("id") id: string): boolean {
//     return this.recipeService.removeById(id);
//   }

//   @FieldResolver()
//   averageRating(@Root() recipe: Recipe) {
//     return recipe.ratings.reduce((a, b) => a + b, 0) / recipe.ratings.length;
//   }
}
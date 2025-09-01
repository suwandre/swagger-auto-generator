import { SwaggerGenerator } from './generators/swagger-generator';
import { SwaggerConfig } from './types';

export { SwaggerGenerator, SwaggerConfig };

export async function generateSwaggerDocs(config: SwaggerConfig): Promise<void> {
  const generator = new SwaggerGenerator(config);
  await generator.generate();
}

// Default export for easy importing
export default {
  generate: generateSwaggerDocs,
  SwaggerGenerator
};

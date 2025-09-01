import { SwaggerGenerator } from './generators/swagger-generator';
import { SwaggerConfig } from './types';
export { SwaggerGenerator, SwaggerConfig };
export declare function generateSwaggerDocs(config: SwaggerConfig): Promise<void>;
declare const _default: {
    generate: typeof generateSwaggerDocs;
    SwaggerGenerator: typeof SwaggerGenerator;
};
export default _default;
//# sourceMappingURL=index.d.ts.map
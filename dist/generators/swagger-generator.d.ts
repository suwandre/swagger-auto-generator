import { SwaggerConfig } from '../types';
export declare class SwaggerGenerator {
    private config;
    constructor(config: SwaggerConfig);
    generate(): Promise<void>;
    private buildSwaggerSpec;
    private formatResponses;
    private writeSwaggerFile;
}
//# sourceMappingURL=swagger-generator.d.ts.map
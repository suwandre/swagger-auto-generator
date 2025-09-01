export interface SwaggerConfig {
    inputPath: string;
    outputPath: string;
    apiInfo: {
        title: string;
        version: string;
        description?: string;
        baseUrl?: string;
    };
    include?: string[];
    exclude?: string[];
}
export interface ParsedFunction {
    name: string;
    parameters: Parameter[];
    returnType?: string;
    comments: string[];
    httpMethod?: string;
    route?: string;
    middleware?: string[];
}
export interface Parameter {
    name: string;
    type: string;
    required: boolean;
    description?: string;
}
export interface SwaggerEndpoint {
    path: string;
    method: string;
    summary: string;
    parameters: SwaggerParameter[];
    responses: SwaggerResponse[];
    tags: string[];
}
export interface SwaggerParameter {
    name: string;
    in: 'query' | 'path' | 'body' | 'header';
    required: boolean;
    type: string;
    description?: string;
}
export interface SwaggerResponse {
    status: number;
    description: string;
    schema?: any;
}
//# sourceMappingURL=index.d.ts.map
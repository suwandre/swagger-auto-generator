import { SwaggerEndpoint } from '../types';
export declare class ControllerParser {
    static parseControllers(filePaths: string[], routerRoutes?: Array<{
        method: string;
        path: string;
        functionName: string;
    }>): Promise<SwaggerEndpoint[]>;
    private static convertToSwaggerEndpoint;
    private static extractBasePathFromFile;
    private static generateRouteFromFunction;
    private static generateSummary;
    private static extractRealParameters;
    private static debugFunctionParsing;
    private static extractBodyFields;
    private static generateResponses;
    private static extractTagFromFile;
    /**
     * Detect if a function is middleware (should not be treated as API endpoint)
     */
    private static isMiddlewareFunction;
    /**
   * Smart HTTP method detection using multiple strategies
   */
    private static inferHttpMethod;
    /**
   * Enhanced function name pattern matching for HTTP methods
   */
    private static inferMethodFromFunctionName;
}
//# sourceMappingURL=controller-parser.d.ts.map
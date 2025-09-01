import { SwaggerEndpoint } from '../types';
export declare class ControllerParser {
    static parseControllers(filePaths: string[]): Promise<SwaggerEndpoint[]>;
    private static convertToSwaggerEndpoint;
    private static extractBasePathFromFile;
    private static generateRouteFromFunction;
    private static generateSummary;
    private static extractRealParameters;
    private static generateResponses;
    private static extractTagFromFile;
}
//# sourceMappingURL=controller-parser.d.ts.map
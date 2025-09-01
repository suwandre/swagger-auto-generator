import { ParsedFunction } from '../types';
export declare class ASTParser {
    static parseFile(content: string): ParsedFunction[];
    private static extractFunctionInfo;
    private static extractParameters;
    private static extractComments;
    private static inferHttpMethod;
    private static extractRoute;
    private static inferParameterType;
}
//# sourceMappingURL=ast-utils.d.ts.map
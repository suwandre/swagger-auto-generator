export declare class FileUtils {
    static findFiles(pattern: string, basePath: string): Promise<string[]>;
    static readFileContent(filePath: string): string;
    static findMicroserviceFiles(basePath: string, includePatterns?: string[], excludePatterns?: string[]): Promise<{
        [key: string]: string[];
    }>;
    /**
    * Parse router.js file to extract route definitions
    * Matches patterns like: router.post("/create-invoice", ..., controller.createInvoice)
    */
    static parseRouterFile(filePath: string): Array<{
        method: string;
        path: string;
        functionName: string;
    }>;
    private static categorizeFile;
}
//# sourceMappingURL=file-utils.d.ts.map
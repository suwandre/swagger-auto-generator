export declare class FileUtils {
    static findFiles(pattern: string, basePath: string): Promise<string[]>;
    static readFileContent(filePath: string): string;
    static findMicroserviceFiles(basePath: string): Promise<{
        [key: string]: string[];
    }>;
    private static categorizeFile;
}
//# sourceMappingURL=file-utils.d.ts.map
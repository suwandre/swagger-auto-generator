"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwaggerGenerator = void 0;
exports.generateSwaggerDocs = generateSwaggerDocs;
const swagger_generator_1 = require("./generators/swagger-generator");
Object.defineProperty(exports, "SwaggerGenerator", { enumerable: true, get: function () { return swagger_generator_1.SwaggerGenerator; } });
async function generateSwaggerDocs(config) {
    const generator = new swagger_generator_1.SwaggerGenerator(config);
    await generator.generate();
}
// Default export for easy importing
exports.default = {
    generate: generateSwaggerDocs,
    SwaggerGenerator: swagger_generator_1.SwaggerGenerator
};
//# sourceMappingURL=index.js.map
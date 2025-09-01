const ASTHelper = require('../utils/ast-helper');
const traverse = require('@babel/traverse').default;

class ValidatorParser {
  constructor() {
    this.validators = {};
  }

  parse(filePath) {
    if (!filePath) return { validators: {} };

    const ast = ASTHelper.parseFile(filePath);
    if (!ast) return { validators: {} };

    const validators = {};

    const { exports, functions } = ASTHelper.extractExports(ast);

    // Analyze each exported validator function
    Object.keys(exports).forEach(validatorName => {
      const validatorSchema = this.analyzeValidator(ast, validatorName);
      if (validatorSchema) {
        validators[validatorName] = validatorSchema;
      }
    });

    return { validators };
  }

  analyzeValidator(ast, validatorName) {
    const schema = {
      name: validatorName,
      fields: [],
      required: [],
      type: 'object',
      properties: {}
    };

    traverse(ast, {
      // Look for validation logic patterns
      CallExpression(path) {
        // Common validation patterns like req.body.email, req.params.id
        if (this.isValidationCall(path.node)) {
          const fieldInfo = this.extractFieldValidation(path.node);
          if (fieldInfo) {
            schema.fields.push(fieldInfo);
            schema.properties[fieldInfo.name] = {
              type: fieldInfo.type,
              description: fieldInfo.description
            };
            
            if (fieldInfo.required) {
              schema.required.push(fieldInfo.name);
            }
          }
        }
      },

      // Look for schema definitions (if using libraries like Joi, Yup, etc.)
      ObjectExpression(path) {
        if (this.isSchemaDefinition(path.node)) {
          const schemaFields = this.extractSchemaFields(path.node);
          schemaFields.forEach(field => {
            schema.fields.push(field);
            schema.properties[field.name] = {
              type: field.type,
              description: field.description
            };
            
            if (field.required) {
              schema.required.push(field.name);
            }
          });
        }
      }
    });

    return schema.fields.length > 0 ? schema : null;
  }

  isValidationCall(node) {
    // Check for common validation patterns
    if (node.callee.type === 'MemberExpression') {
      const object = node.callee.object;
      const property = node.callee.property;
      
      // req.body.field, req.params.field, req.query.field
      if (
        object.type === 'MemberExpression' &&
        object.object.name === 'req' &&
        ['body', 'params', 'query'].includes(object.property.name)
      ) {
        return true;
      }
    }
    
    return false;
  }

  extractFieldValidation(node) {
    try {
      const reqType = node.callee.object.property.name; // body, params, query
      const fieldName = node.callee.property.name;
      
      return {
        name: fieldName,
        in: reqType === 'params' ? 'path' : reqType === 'query' ? 'query' : 'body',
        type: 'string', // Default type, can be enhanced
        required: true, // Default, can be enhanced
        description: `${fieldName} field`
      };
    } catch (error) {
      return null;
    }
  }

  isSchemaDefinition(node) {
    // Look for schema object patterns
    return node.properties.some(prop => 
      prop.key && ['type', 'required', 'properties'].includes(prop.key.name)
    );
  }

  extractSchemaFields(node) {
    const fields = [];
    
    node.properties.forEach(prop => {
      if (prop.key && prop.key.name === 'properties' && prop.value.type === 'ObjectExpression') {
        prop.value.properties.forEach(fieldProp => {
          if (fieldProp.key) {
            const fieldName = fieldProp.key.name;
            const fieldDef = this.analyzeFieldDefinition(fieldProp.value);
            
            fields.push({
              name: fieldName,
              ...fieldDef
            });
          }
        });
      }
    });

    return fields;
  }

  analyzeFieldDefinition(node) {
    const field = {
      type: 'string',
      required: false,
      description: ''
    };

    if (node.type === 'ObjectExpression') {
      node.properties.forEach(prop => {
        if (prop.key) {
          switch (prop.key.name) {
            case 'type':
              if (prop.value.type === 'StringLiteral') {
                field.type = prop.value.value;
              }
              break;
            case 'required':
              if (prop.value.type === 'BooleanLiteral') {
                field.required = prop.value.value;
              }
              break;
            case 'description':
              if (prop.value.type === 'StringLiteral') {
                field.description = prop.value.value;
              }
              break;
          }
        }
      });
    }

    return field;
  }
}

module.exports = ValidatorParser;

const PKG_NAME = 'react-chunk';

export default function({ types: t, template }) {
  return {
    visitor: {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source !== PKG_NAME) return;

        const importSpecifiers = path.get('specifiers').filter(specifier => {
          if (specifier.isImportSpecifier()) {
            return ['chunk', 'chunks'].indexOf(specifier.node.imported.name) !== -1;
          }

          return false;
        });

        if (!importSpecifiers.length) {
          return;
        }

        importSpecifiers.forEach(importSpecifier => {
          const bindingName = importSpecifier.node.local.name;
          const binding = path.scope.getBinding(bindingName);

          binding.referencePaths.forEach(refPath => {
            const callExpression = refPath.parentPath;
            if (!callExpression.isCallExpression()) {
              return;
            }

            const writableChunkArgs = callExpression.node.arguments;
            if (writableChunkArgs.length === 0) {
              throw callExpression.error; // missing import
            }

            const importStatement = callExpression.get('arguments')[0];

            let userOptions;
            const propertiesMap = {};
            if (writableChunkArgs.length > 1) {
              userOptions = callExpression.get('arguments')[1];
              if (t.isObjectExpression(userOptions)) {
                userOptions.get('properties').forEach(property => {
                  const key = property.get('key');
                  propertiesMap[key.node.name] = property;
                });
              }
            }
            else {
              userOptions = t.objectExpression([]);
              writableChunkArgs.push(userOptions);
            }

            // webpack options have been manually applied
            if (propertiesMap.webpack) {
                return;
            }

            // identify all import() statements
            const dynamicImports = [];
            importStatement.traverse({
              Import(path) {
                dynamicImports.push(path.parentPath);
              }
            });

            if (!dynamicImports.length) {
              return;
            }

            const generatedArgs = [];
            generatedArgs.push( // add the prop
              t.objectProperty(
                t.identifier('webpack'),
                t.arrowFunctionExpression(
                  [],
                  t.arrayExpression(
                    dynamicImports.map(dynamicImport => {
                      return t.callExpression(
                        t.memberExpression(
                          t.identifier('require'),
                          t.identifier('resolveWeak'),
                        ),
                        [dynamicImport.get('arguments')[0].node],
                      )
                    })
                  )
                )
              )
            );

            generatedArgs.push( // add the prop
              t.objectProperty(
                t.identifier('modules'),
                t.arrayExpression(
                  dynamicImports.map(dynamicImport => {
                    return dynamicImport.get('arguments')[0].node;
                  })
                )
              )
            );

            writableChunkArgs.push(t.objectExpression(generatedArgs));
          });
        });
      }
    }
  };
}

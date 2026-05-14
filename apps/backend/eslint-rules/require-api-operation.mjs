const HTTP_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Options', 'Head']);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: { description: 'Require @ApiOperation on every NestJS HTTP handler method' },
    messages: {
      missing: 'HTTP handler is missing @ApiOperation({ summary }). Add one from @nestjs/swagger.',
    },
    schema: [],
  },
  create(context) {
    return {
      MethodDefinition(node) {
        const decorators = node.decorators ?? [];
        if (decorators.length === 0) return;

        const names = decorators
          .map((d) => {
            const expr = d.expression;
            if (expr.type === 'CallExpression' && expr.callee.type === 'Identifier') return expr.callee.name;
            if (expr.type === 'Identifier') return expr.name;
            return null;
          })
          .filter(Boolean);

        const isHttpHandler = names.some((n) => HTTP_DECORATORS.has(n));
        if (!isHttpHandler) return;

        const hasApiOperation = names.includes('ApiOperation');
        if (!hasApiOperation) {
          context.report({ node, messageId: 'missing' });
        }
      },
    };
  },
};

export default rule;

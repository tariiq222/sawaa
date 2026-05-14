import { RuleTester } from 'eslint';
import rule from './require-api-operation.mjs';

const tester = new RuleTester({
  languageOptions: {
    parser: (await import('@typescript-eslint/parser')).default,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
});

tester.run('require-api-operation', rule, {
  valid: [
    {
      code: `
        class C {
          @Get()
          @ApiOperation({ summary: 'x' })
          foo() {}
        }
      `,
    },
    {
      code: `
        class C {
          bar() {}  // no HTTP decorator — allowed
        }
      `,
    },
  ],
  invalid: [
    {
      code: `
        class C {
          @Get()
          foo() {}
        }
      `,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: `
        class C {
          @Post('/x')
          @UseGuards(X)
          foo() {}
        }
      `,
      errors: [{ messageId: 'missing' }],
    },
  ],
});

console.log('require-api-operation: all tests passed');

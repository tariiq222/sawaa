import 'reflect-metadata';
import { ChatCompletionDto } from './chat-completion.dto';

describe('ChatCompletionDto', () => {
  it('should be defined', () => {
    const dto = new ChatCompletionDto();
    expect(dto).toBeDefined();
  });
});
